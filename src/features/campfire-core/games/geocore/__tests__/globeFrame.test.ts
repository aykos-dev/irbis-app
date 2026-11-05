import { geoSizes } from '../../../campTheme';
import {
  fillRings,
  invertScreen,
  makeFrame,
  projectLatLng,
  pushToRim,
  strokeLines,
  toVector,
  type PathSink,
  type SphereLines,
} from '../globeFrame';
import {
  borderLines,
  graticuleLines,
  landLines,
  ringsOf,
} from '../globeGeometry';
import { baseRadius, projectPoint } from '../globeProjection';

const SIZE = geoSizes.board;
const frameFor = (lng: number, lat: number, zoom = 1) =>
  makeFrame(lng, lat, baseRadius(SIZE) * zoom, SIZE);

type Op = { op: 'M' | 'L' | 'Z'; x: number; y: number };
const recorder = () => {
  const ops: Op[] = [];
  const sink: PathSink = {
    moveTo: (x, y) => ops.push({ op: 'M', x, y }),
    lineTo: (x, y) => ops.push({ op: 'L', x, y }),
    close: () => ops.push({ op: 'Z', x: 0, y: 0 }),
  };
  return { ops, sink };
};

const linesOf = (points: [number, number][][]): SphereLines => {
  const all = points.flat();
  const xyz = new Float32Array(all.length * 3);
  all.forEach(([lng, lat], i) => xyz.set(toVector(lat, lng), i * 3));
  const starts = new Int32Array(points.length + 1);
  points.reduce((offset, line, i) => {
    starts[i] = offset;
    return offset + line.length;
  }, 0);
  starts[points.length] = all.length;
  return { xyz, starts };
};

describe('globe worklet math', () => {
  it('projects like d3 and round-trips screen → lat/lng within 1e-6', () => {
    const view = { lng: 37, lat: -12, zoom: 2.5 };
    const f = frameFor(view.lng, view.lat, view.zoom);
    for (const point of [
      { lat: -1.3, lng: 36.8 },
      { lat: -20, lng: 50 },
      { lat: 10, lng: 20 },
    ]) {
      const p = projectLatLng(f, point.lat, point.lng);
      const d3 = projectPoint(SIZE, view, point);
      expect(p.z).toBeGreaterThan(0);
      expect(p.x).toBeCloseTo(d3!.x, 6);
      expect(p.y).toBeCloseTo(d3!.y, 6);
      const back = invertScreen(f, p.x, p.y)!;
      expect(Math.abs(back.lat - point.lat)).toBeLessThan(1e-6);
      expect(Math.abs(back.lng - point.lng)).toBeLessThan(1e-6);
    }
    expect(invertScreen(frameFor(0, 0), 1, 1)).toBeNull();
  });

  it('puts the far side at z < 0 and pushes it onto the rim', () => {
    const f = frameFor(60, 30);
    const far = projectLatLng(f, -30, -120);
    expect(far.z).toBeLessThan(0);
    const [x, y] = pushToRim(f, far.x, far.y);
    expect(Math.hypot(x - f.cx, y - f.cy)).toBeCloseTo(f.r, 6);
  });

  it('keeps a ring that crosses the horizon closed and inside the disc', () => {
    const f = frameFor(0, 0);
    const ring = linesOf([
      [
        [60, -10],
        [120, -10],
        [120, 10],
        [60, 10],
        [60, -10],
      ],
    ]);
    const { ops, sink } = recorder();
    fillRings(sink, ring, 0, 1, f, 0);
    expect(ops.at(0)?.op).toBe('M');
    expect(ops.at(-1)?.op).toBe('Z');
    expect(ops.filter(item => item.op === 'M')).toHaveLength(1);
    for (const item of ops.filter(op => op.op !== 'Z')) {
      expect(Math.hypot(item.x - f.cx, item.y - f.cy)).toBeLessThanOrEqual(
        f.r + 1e-6,
      );
    }
  });

  it('skips a ring wholly on the far side and breaks strokes at the horizon', () => {
    const f = frameFor(0, 0);
    const hidden = linesOf([
      [
        [170, 0],
        [175, 5],
        [-175, 0],
        [170, 0],
      ],
    ]);
    const filled = recorder();
    fillRings(filled.sink, hidden, 0, 1, f, 0);
    expect(filled.ops).toHaveLength(0);

    const across = linesOf([
      [
        [0, 0],
        [80, 0],
        [100, 0],
        [180, 0],
      ],
    ]);
    const stroked = recorder();
    strokeLines(stroked.sink, across, f, 0);
    const last = stroked.ops.at(-1) ?? { x: 0, y: 0 };
    expect(stroked.ops.map(item => item.op)).toEqual(['M', 'L', 'L']);
    expect(Math.hypot(last.x - f.cx, last.y - f.cy)).toBeCloseTo(f.r, 4);
  });

  it('builds the land, border mesh and graticule once, indexed by iso', () => {
    expect(landLines.starts.length).toBeGreaterThan(100);
    expect(borderLines.xyz.length).toBeGreaterThan(0);
    expect(graticuleLines.starts.length - 1).toBe(36 + 17);
    const kenya = ringsOf('ke');
    expect(kenya.to).toBeGreaterThan(kenya.from);
    expect(ringsOf('XX')).toEqual({ from: 0, to: 0 });
  });
});
