/**
 * Flat map data, built once at module load: an offline MapLibre style (no tiles, fonts or sprites),
 * the playable countries and a 10° graticule as GeoJSON, and the microstate dots with the zoom
 * each one appears from. Plus the Web Mercator maths the taps use.
 */
import type {
  FilterSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { geoContains } from 'd3-geo';

import type { LatLng } from '../../../../shared/utils/geo';
import { geoColors, geoSizes } from '../../campTheme';
import { countries, countryBorders, countryFeatures, microstates } from './geoData';

const {
  tileSize,
  mapMinZoom,
  zoomRange,
  microMaxZoom,
  microGap,
  microHit,
  microSnap,
  maxLat,
  graticuleStep,
} = geoSizes;

/** Inline style, version 8: the ocean only. Sources and layers come from the map's children. */
export const mapStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'geo-ocean',
      type: 'background',
      paint: { 'background-color': geoColors.ocean },
    },
  ],
};

/** Longitude folded into [-180, 180). */
export function wrapLng(lng: number): number {
  if (lng >= -180 && lng < 180) {
    return lng;
  }
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Web Mercator, in world units (0–1 across and down). */
export function toMercator(point: LatLng): { x: number; y: number } {
  const lat = (clamp(point.lat, -maxLat, maxLat) * Math.PI) / 180;
  return {
    x: (wrapLng(point.lng) + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2,
  };
}

export function fromMercator(x: number, y: number): LatLng {
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
  return { lat: (lat * 180) / Math.PI, lng: wrapLng(x * 360 - 180) };
}

/** World width in pt at `zoom`. */
export const worldSize = (zoom: number) => tileSize * 2 ** zoom;

/** Screen distance in pt between two points at `zoom` (the shorter way round in longitude). */
export function pixelDistance(a: LatLng, b: LatLng, zoom: number): number {
  const p = toMercator(a);
  const q = toMercator(b);
  const dx = Math.abs(p.x - q.x);
  return Math.hypot(Math.min(dx, 1 - dx), p.y - q.y) * worldSize(zoom);
}

/**
 * The lowest zoom: the whole world width fits a box `width` pt wide, but never below MapLibre's
 * lowest zoom (0, a 512 pt world), so a phone-sized box shows most of the world and pans to the rest.
 */
export function fitZoom(width: number): number {
  return width > 0
    ? Math.max(mapMinZoom, Math.log2(width / tileSize))
    : mapMinZoom;
}

type Position = GeoJSON.Position;

const lngOf = (point: Position | undefined) => point?.[0] ?? 0;
const latOf = (point: Position | undefined) => point?.[1] ?? 0;

/** True when two consecutive points are more than 180° apart in longitude (the antimeridian). */
export const jumpsAntimeridian = (line: Position[]) =>
  line.some((point, i) => i > 0 && Math.abs(lngOf(point) - lngOf(line[i - 1])) > 180);

/** The line with each longitude shifted by whole turns so no step exceeds 180°. */
function unwrap(line: Position[]): Position[] {
  let shift = 0;
  let prev: number | null = null;
  return line.map(point => {
    const lng = lngOf(point);
    if (prev !== null) {
      const step = lng + shift - prev;
      shift += step > 180 ? -360 : step < -180 ? 360 : 0;
    }
    prev = lng + shift;
    return [prev, latOf(point)];
  });
}

/** One closed ring clipped to longitudes [lo, hi] (Sutherland–Hodgman), shifted by `by`. */
function clipRing(ring: Position[], lo: number, hi: number, by: number): Position[] {
  const edges: [number, (x: number) => boolean][] = [
    [lo, x => x >= lo],
    [hi, x => x <= hi],
  ];
  let points = ring;
  for (const [edge, inside] of edges) {
    const out: Position[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length] ?? a;
      const aIn = inside(lngOf(a));
      if (aIn) {
        out.push(a);
      }
      if (aIn !== inside(lngOf(b))) {
        const t = (edge - lngOf(a)) / (lngOf(b) - lngOf(a));
        out.push([edge, latOf(a) + t * (latOf(b) - latOf(a))]);
      }
    });
    points = out;
  }
  const shifted = points.map(point => [lngOf(point) + by, latOf(point)]);
  const first = shifted[0];
  return first ? [...shifted, first] : [];
}

/**
 * A polygon whose rings cross ±180° split into polygons on each side, so MapLibre (flat, no
 * wrapping) never draws a ring the long way round. A ring round a pole is closed along it.
 */
function splitPolygon(polygon: Position[][]): Position[][][] {
  if (!polygon.some(jumpsAntimeridian)) {
    return [polygon];
  }
  const rings = polygon.map(ring => {
    const open = unwrap(ring);
    const turn = lngOf(open[open.length - 1]) - lngOf(open[0]);
    if (Math.abs(turn) < 180) {
      return open;
    }
    const mean = open.reduce((sum, point) => sum + latOf(point), 0) / open.length;
    const pole = mean < 0 ? -90 : 90;
    return [
      ...open,
      [lngOf(open[open.length - 1]), pole],
      [lngOf(open[0]), pole],
    ];
  });
  const xs = rings.flat().map(lngOf);
  const from = Math.floor((Math.min(...xs) + 180) / 360);
  const to = Math.floor((Math.max(...xs) + 180) / 360);
  const parts: Position[][][] = [];
  for (let k = from; k <= to; k++) {
    const lo = k * 360 - 180;
    const [outer, ...holes] = rings.map(ring => clipRing(ring, lo, lo + 360, -k * 360));
    if (outer && outer.length >= 4) {
      parts.push([outer, ...holes.filter(hole => hole.length >= 4)]);
    }
  }
  return parts;
}

/** A line cut where it crosses ±180°, each piece ending on the antimeridian. */
function splitLine(line: Position[]): Position[][] {
  const pieces: Position[][] = [];
  let piece: Position[] = [];
  line.forEach((point, i) => {
    const prev = line[i - 1];
    if (prev && Math.abs(lngOf(point) - lngOf(prev)) > 180) {
      const edge = lngOf(prev) > 0 ? 180 : -180;
      const across = lngOf(point) + (edge > 0 ? 360 : -360);
      const t = (edge - lngOf(prev)) / (across - lngOf(prev));
      const lat = latOf(prev) + t * (latOf(point) - latOf(prev));
      piece.push([edge, lat]);
      pieces.push(piece);
      piece = [[-edge, lat]];
    }
    piece.push(point);
  });
  pieces.push(piece);
  return pieces.filter(item => item.length >= 2);
}

/** Playable countries, split at the antimeridian; `iso` on every feature. */
export const countryShapes: GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  { iso: string }
> = {
  type: 'FeatureCollection',
  features: countries.flatMap(country => {
    const outline = countryFeatures.get(country.n3);
    if (!outline) {
      return [];
    }
    const { geometry } = outline;
    const polygons =
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return [
      {
        type: 'Feature' as const,
        properties: { iso: country.iso },
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: polygons.flatMap(splitPolygon),
        },
      },
    ];
  }),
};

/** Borders and coasts, each shared arc once, cut at the antimeridian. */
export const borderLines: GeoJSON.Feature<GeoJSON.MultiLineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'MultiLineString',
    coordinates: countryBorders.coordinates.flatMap(splitLine),
  },
};

function steps(from: number, to: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += graticuleStep) {
    values.push(value);
  }
  return values;
}

/** A line every 10°: meridians pole to pole, parallels to ±80°, sampled every 10° (no long steps). */
export const graticule: GeoJSON.Feature<GeoJSON.MultiLineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      ...steps(-180, 180 - graticuleStep).map(lng => [
        [lng, -maxLat],
        [lng, maxLat],
      ]),
      ...steps(-80, 80).map(lat => steps(-180, 180).map(lng => [lng, lat])),
    ],
  },
};

/**
 * Each microstate dot's first zoom (0–8, or past 8 when never clear), greedy in pack order: a dot
 * shows from the lowest zoom where it is at least 18 pt from every earlier dot, measured at the
 * zoom both are shown from. Distances only grow with zoom, so no two shown dots ever overlap.
 */
function dotZooms(points: LatLng[]): number[] {
  const zooms: number[] = [];
  points.forEach((point, index) => {
    let zoom = mapMinZoom;
    while (
      zoom <= microMaxZoom &&
      points
        .slice(0, index)
        .some(
          (other, j) =>
            pixelDistance(point, other, Math.max(zoom, zooms[j] ?? zoom)) <
            microGap,
        )
    ) {
      zoom++;
    }
    zooms.push(zoom);
  });
  return zooms;
}

export type MicroDot = { iso: string; at: LatLng; minZoom: number };

export const microDots: MicroDot[] = (() => {
  const points = microstates.map(item => ({ lat: item.lat, lng: item.lng }));
  const zooms = dotZooms(points);
  return microstates.map((item, index) => ({
    iso: item.iso,
    at: points[index] ?? { lat: item.lat, lng: item.lng },
    minZoom: zooms[index] ?? microMaxZoom + 1,
  }));
})();

export const microPoints: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { iso: string; minZoom: number }
> = {
  type: 'FeatureCollection',
  features: microDots.map(dot => ({
    type: 'Feature',
    properties: { iso: dot.iso, minZoom: dot.minZoom },
    geometry: { type: 'Point', coordinates: [dot.at.lng, dot.at.lat] },
  })),
};

/** The highest zoom: 3 levels in (8×), raised so every dot clear by zoom 8 can be shown. */
export function maxZoomFor(minZoom: number): number {
  const deepest = microDots.reduce(
    (deep, dot) => (dot.minZoom <= microMaxZoom ? Math.max(deep, dot.minZoom) : deep),
    0,
  );
  return Math.max(minZoom + zoomRange, deepest);
}

/** Map zoom for a globe-style factor (4 → 2 levels in, 2 → 1), from the lowest zoom. */
export function zoomFor(minZoom: number, factor?: number): number {
  return factor && factor > 1 ? minZoom + Math.log2(factor) : minZoom;
}

/** Dots shown at `zoom` (the layer's `minZoom` filter). */
export const microShownFilter: FilterSpecification = [
  '>=',
  ['zoom'],
  ['get', 'minZoom'],
];

/** One country's features (none for an empty code). */
export function isoFilter(iso: string | null | undefined): FilterSpecification {
  return ['==', ['get', 'iso'], iso ? iso.toUpperCase() : ''];
}

/** The shown dot nearest `at` within `reach` pt (default 22) at `zoom`, or null. */
export function microAt(
  at: LatLng,
  zoom: number,
  reach: number = microHit,
): MicroDot | null {
  let best: MicroDot | null = null;
  let bestDistance = reach;
  for (const dot of microDots) {
    if (dot.minZoom > zoom) {
      continue;
    }
    const distance = pixelDistance(at, dot.at, zoom);
    if (distance <= bestDistance) {
      best = dot;
      bestDistance = distance;
    }
  }
  return best;
}

const microIsos = new Set(microstates.map(item => item.iso));

/**
 * What a country-mode press at `at` picks: a shown dot within 10 pt of its centre; else the
 * country under the finger unless it is a microstate; else (ocean or a microstate's own outline)
 * the nearest shown dot within 22 pt; else that microstate's outline, or nothing.
 */
export function pickCountry(
  at: LatLng,
  zoom: number,
): { iso: string; at: LatLng } | null {
  const onDot = microAt(at, zoom, microSnap);
  if (onDot) {
    return { iso: onDot.iso, at: onDot.at };
  }
  const iso = countryAt(at);
  if (iso && !microIsos.has(iso)) {
    return { iso, at };
  }
  const near = microAt(at, zoom);
  if (near) {
    return { iso: near.iso, at: near.at };
  }
  return iso ? { iso, at } : null;
}

/** ISO code of the playable country containing `point`, or null (ocean, unlisted territory). */
export function countryAt(point: LatLng): string | null {
  for (const country of countries) {
    const outline = countryFeatures.get(country.n3);
    if (outline && geoContains(outline, [point.lng, point.lat])) {
      return country.iso;
    }
  }
  return null;
}
