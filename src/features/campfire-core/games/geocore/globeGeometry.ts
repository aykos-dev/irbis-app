/**
 * Globe geometry, built once at module load: flat unit-sphere vectors for the land rings, the
 * border mesh and the graticule. The frame loop (globeFrame.ts) only rotates and projects these.
 */
import { geoSizes } from '../../campTheme';
import { countries, countryBorders, countryFeatures } from './geoData';
import type { SphereLines } from './globeFrame';

const RAD = Math.PI / 180;

type Position = GeoJSON.Position;

function pack(lines: Position[][]): SphereLines {
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const xyz = new Float32Array(total * 3);
  const starts = new Int32Array(lines.length + 1);
  let v = 0;
  lines.forEach((line, index) => {
    starts[index] = v;
    for (const [lng = 0, lat = 0] of line) {
      const cosLat = Math.cos(lat * RAD);
      xyz[v * 3] = cosLat * Math.cos(lng * RAD);
      xyz[v * 3 + 1] = cosLat * Math.sin(lng * RAD);
      xyz[v * 3 + 2] = Math.sin(lat * RAD);
      v++;
    }
  });
  starts[lines.length] = v;
  return { xyz, starts };
}

/** Ring range of one country inside `land` (`to` exclusive). */
export type RingRange = { from: number; to: number };

function buildLand(): { land: SphereLines; ranges: Map<string, RingRange> } {
  const rings: Position[][] = [];
  const ranges = new Map<string, RingRange>();
  for (const country of countries) {
    const outline = countryFeatures.get(country.n3);
    if (!outline) {
      continue;
    }
    const from = rings.length;
    const { geometry } = outline;
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const polygon of polygons) {
      rings.push(...polygon);
    }
    ranges.set(country.iso, { from, to: rings.length });
  }
  return { land: pack(rings), ranges };
}

function range(from: number, to: number, step: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) {
    values.push(value);
  }
  return values;
}

function buildGraticule(): SphereLines {
  const {
    graticuleStep: step,
    graticuleSample: sample,
    graticuleMaxLat,
  } = geoSizes;
  const lines: Position[][] = [];
  for (const lng of range(-180, 180 - step, step)) {
    const extent = lng % 90 === 0 ? 90 : graticuleMaxLat;
    lines.push(range(-extent, extent, sample).map(lat => [lng, lat]));
  }
  for (const lat of range(-graticuleMaxLat, graticuleMaxLat, step)) {
    lines.push(range(-180, 180, sample).map(lng => [lng, lat]));
  }
  return pack(lines);
}

const built = buildLand();

/** Every playable country's rings (fill). */
export const landLines: SphereLines = built.land;
/** Borders and coasts, each shared arc once (stroke). */
export const borderLines: SphereLines = pack(countryBorders.coordinates);
/** 10° graticule sampled every 2° (stroke). */
export const graticuleLines: SphereLines = buildGraticule();

const noRings: RingRange = { from: 0, to: 0 };

/** The rings of one country in `landLines` (empty when it has no outline). */
export function ringsOf(iso: string | null | undefined): RingRange {
  return (iso && built.ranges.get(iso.toUpperCase())) || noRings;
}
