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
import { countries, countryFeatures, microstates } from './geoData';

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

/** Playable countries; `iso` on every feature. */
export const countryShapes: GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { iso: string }
> = {
  type: 'FeatureCollection',
  features: countries.flatMap(country => {
    const outline = countryFeatures.get(country.n3);
    return outline
      ? [
          {
            type: 'Feature' as const,
            properties: { iso: country.iso },
            geometry: outline.geometry,
          },
        ]
      : [];
  }),
};

function steps(from: number, to: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += graticuleStep) {
    values.push(value);
  }
  return values;
}

/** A line every 10°: meridians pole to pole, parallels to ±80° (straight lines in Mercator). */
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
      ...steps(-80, 80).map(lat => [
        [-180, lat],
        [180, lat],
      ]),
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
