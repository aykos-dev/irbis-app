/**
 * Per-frame globe math, safe on the UI thread: every function is a worklet and allocates nothing
 * per vertex. Orthographic projection matching d3 `geoOrthographic().rotate([-lng, -lat])`.
 */
import type { LatLng } from '../../../../shared/utils/geo';

const RAD = Math.PI / 180;

/** Flat unit-sphere vectors (x, y, z per vertex) cut into polylines / rings by `starts`. */
export type SphereLines = {
  xyz: Float32Array;
  /** Vertex offset of each line; `starts[n]` is the vertex count (length = lines + 1). */
  starts: Int32Array;
};

/** The part of a path builder the globe uses (Skia's SkPathBuilder fits it). */
export type PathSink = {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  close(): unknown;
};

/** One frame's rotation and placement: centre (lambda, phi) in degrees, radius and centre in pt. */
export type Frame = {
  cosL: number;
  sinL: number;
  cosP: number;
  sinP: number;
  r: number;
  cx: number;
  cy: number;
};

export type Projected = { x: number; y: number; z: number };

export function clampValue(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/** Longitude folded into [-180, 180). */
export function wrapDegrees(lng: number): number {
  'worklet';
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function makeFrame(
  lambda: number,
  phi: number,
  radius: number,
  size: number,
): Frame {
  'worklet';
  return {
    cosL: Math.cos(lambda * RAD),
    sinL: Math.sin(lambda * RAD),
    cosP: Math.cos(phi * RAD),
    sinP: Math.sin(phi * RAD),
    r: radius,
    cx: size / 2,
    cy: size / 2,
  };
}

/** Unit vector of a point (x towards 0°/0°, z towards the north pole). */
export function toVector(lat: number, lng: number): [number, number, number] {
  'worklet';
  const cosLat = Math.cos(lat * RAD);
  return [
    cosLat * Math.cos(lng * RAD),
    cosLat * Math.sin(lng * RAD),
    Math.sin(lat * RAD),
  ];
}

/** Screen position of a unit vector; z < 0 is the far side. */
export function projectVector(
  f: Frame,
  x0: number,
  y0: number,
  z0: number,
): Projected {
  'worklet';
  const x = x0 * f.cosL + y0 * f.sinL;
  const east = -x0 * f.sinL + y0 * f.cosL;
  const depth = x * f.cosP + z0 * f.sinP;
  const up = -x * f.sinP + z0 * f.cosP;
  return { x: f.cx + f.r * east, y: f.cy - f.r * up, z: depth };
}

export function projectLatLng(f: Frame, lat: number, lng: number): Projected {
  'worklet';
  const [x0, y0, z0] = toVector(lat, lng);
  return projectVector(f, x0, y0, z0);
}

/** A far-side point moved onto the rim, along its direction from the centre. */
export function pushToRim(f: Frame, x: number, y: number): [number, number] {
  'worklet';
  const dx = x - f.cx;
  const dy = y - f.cy;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return [f.cx + f.r, f.cy];
  }
  return [f.cx + (dx / length) * f.r, f.cy + (dy / length) * f.r];
}

/** The point under a screen position (inverse orthographic), or null off the disc. */
export function invertScreen(f: Frame, sx: number, sy: number): LatLng | null {
  'worklet';
  if (f.r <= 0) {
    return null;
  }
  const east = (sx - f.cx) / f.r;
  const up = -(sy - f.cy) / f.r;
  const planar = east * east + up * up;
  if (planar > 1) {
    return null;
  }
  const depth = Math.sqrt(1 - planar);
  const x = depth * f.cosP - up * f.sinP;
  const z0 = depth * f.sinP + up * f.cosP;
  const x0 = x * f.cosL - east * f.sinL;
  const y0 = x * f.sinL + east * f.cosL;
  return {
    lat: Math.asin(clampValue(z0, -1, 1)) / RAD,
    lng: Math.atan2(y0, x0) / RAD,
  };
}

/**
 * Filled rings `from`..`to` (exclusive) of `lines`: a ring wholly on the far side is skipped, a
 * far-side vertex of a ring that is partly visible is pushed to the rim, so the polygon stays closed
 * and clipped to the disc.
 */
export function fillRings(
  sink: PathSink,
  lines: SphereLines,
  from: number,
  to: number,
  f: Frame,
  minStep: number,
): void {
  'worklet';
  const { xyz, starts } = lines;
  const a = f.cosL;
  const b = f.sinL;
  for (let ring = from; ring < to; ring++) {
    const start = starts[ring] ?? 0;
    const end = starts[ring + 1] ?? 0;
    let visible = false;
    for (let v = start; v < end && !visible; v++) {
      const i = v * 3;
      visible =
        ((xyz[i] ?? 0) * a + (xyz[i + 1] ?? 0) * b) * f.cosP +
          (xyz[i + 2] ?? 0) * f.sinP >=
        0;
    }
    if (!visible) {
      continue;
    }
    let drawn = 0;
    let lastX = 0;
    let lastY = 0;
    for (let v = start; v < end; v++) {
      const i = v * 3;
      const p = projectVector(
        f,
        xyz[i] ?? 0,
        xyz[i + 1] ?? 0,
        xyz[i + 2] ?? 0,
      );
      let px = p.x;
      let py = p.y;
      if (p.z < 0) {
        const rim = pushToRim(f, px, py);
        px = rim[0];
        py = rim[1];
      }
      if (drawn === 0) {
        sink.moveTo(px, py);
      } else if (Math.abs(px - lastX) + Math.abs(py - lastY) >= minStep) {
        sink.lineTo(px, py);
      } else {
        continue;
      }
      drawn++;
      lastX = px;
      lastY = py;
    }
    sink.close();
  }
}

/** Open polylines (borders, graticule): the line breaks at the horizon, ending on the rim. */
export function strokeLines(
  sink: PathSink,
  lines: SphereLines,
  f: Frame,
  minStep: number,
): void {
  'worklet';
  const { xyz, starts } = lines;
  const count = starts.length - 1;
  for (let line = 0; line < count; line++) {
    let down = false;
    let prevX = 0;
    let prevY = 0;
    let prevZ = -1;
    let lastX = 0;
    let lastY = 0;
    const start = starts[line] ?? 0;
    const end = starts[line + 1] ?? 0;
    for (let v = start; v < end; v++) {
      const i = v * 3;
      const p = projectVector(
        f,
        xyz[i] ?? 0,
        xyz[i + 1] ?? 0,
        xyz[i + 2] ?? 0,
      );
      const first = v === start;
      if (p.z >= 0) {
        if (!down) {
          if (!first && prevZ < 0) {
            const t = prevZ / (prevZ - p.z);
            const edge = pushToRim(
              f,
              prevX + (p.x - prevX) * t,
              prevY + (p.y - prevY) * t,
            );
            sink.moveTo(edge[0], edge[1]);
            sink.lineTo(p.x, p.y);
          } else {
            sink.moveTo(p.x, p.y);
          }
          down = true;
          lastX = p.x;
          lastY = p.y;
        } else if (Math.abs(p.x - lastX) + Math.abs(p.y - lastY) >= minStep) {
          sink.lineTo(p.x, p.y);
          lastX = p.x;
          lastY = p.y;
        }
      } else if (down) {
        const t = prevZ / (prevZ - p.z);
        const edge = pushToRim(
          f,
          prevX + (p.x - prevX) * t,
          prevY + (p.y - prevY) * t,
        );
        sink.lineTo(edge[0], edge[1]);
        down = false;
      }
      prevX = p.x;
      prevY = p.y;
      prevZ = p.z;
    }
  }
}
