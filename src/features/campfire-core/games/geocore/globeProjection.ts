import {
  geoContains,
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from 'd3-geo';

import type { LatLng } from '../../../../shared/utils/geo';
import { geoSizes } from '../../campTheme';
import { countries, countryByIso, countryFeatures } from './geoData';

/** What the globe shows: the point at its centre and the zoom (1×–8×). */
export type GlobeView = { lng: number; lat: number; zoom: number };

export type ScreenPoint = { x: number; y: number };

export const initialView: GlobeView = {
  lng: geoSizes.initialLng,
  lat: geoSizes.initialLat,
  zoom: geoSizes.minZoom,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Longitude folded into [-180, 180). */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function clampLat(lat: number): number {
  return clamp(lat, -geoSizes.maxLat, geoSizes.maxLat);
}

export function clampZoom(zoom: number): number {
  return clamp(zoom, geoSizes.minZoom, geoSizes.maxZoom);
}

/** Globe radius at zoom 1 for a square box of `size` pt (board: 358 → 172). */
export function baseRadius(size: number): number {
  return size * geoSizes.radiusRatio;
}

/** Orthographic projection centred on `view`, clipped to the visible hemisphere. */
export function createProjection(size: number, view: GlobeView): GeoProjection {
  return geoOrthographic()
    .clipAngle(90)
    .translate([size / 2, size / 2])
    .scale(baseRadius(size) * view.zoom)
    .rotate([-view.lng, -view.lat]);
}

/**
 * A drag of (dx, dy) pt: λ += dx·k, φ −= dy·k with k = one pt of arc at the current scale (so it
 * shrinks by 1/zoom). The view stores the centre, which is the negated rotation.
 */
export function rotateBy(
  view: GlobeView,
  dx: number,
  dy: number,
  size: number,
): GlobeView {
  const k = 180 / (Math.PI * baseRadius(size) * view.zoom);
  return {
    ...view,
    lng: wrapLng(view.lng - dx * k),
    lat: clampLat(view.lat + dy * k),
  };
}

/** True when `point` is on the hemisphere facing the viewer. */
export function isVisible(view: GlobeView, point: LatLng): boolean {
  return (
    geoDistance([point.lng, point.lat], [view.lng, view.lat]) < Math.PI / 2
  );
}

/** Screen position of `point`, or null on the far side. */
export function projectPoint(
  size: number,
  view: GlobeView,
  point: LatLng,
): ScreenPoint | null {
  if (!isVisible(view, point)) {
    return null;
  }
  const xy = createProjection(size, view)([point.lng, point.lat]);
  return xy ? { x: xy[0], y: xy[1] } : null;
}

/** The point under a touch, or null outside the sphere. */
export function invertPoint(
  size: number,
  view: GlobeView,
  touch: ScreenPoint,
): LatLng | null {
  const radius = baseRadius(size) * view.zoom;
  if (Math.hypot(touch.x - size / 2, touch.y - size / 2) > radius) {
    return null;
  }
  const lngLat = createProjection(size, view).invert?.([touch.x, touch.y]);
  if (!lngLat || !Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) {
    return null;
  }
  return { lng: lngLat[0], lat: lngLat[1] };
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

export type GlobePaths = {
  sphere: string;
  graticule: string;
  countries: { iso: string; d: string }[];
};

/** Every path string for one view. Callers memoise this per (rotation, zoom). */
export function buildPaths(size: number, view: GlobeView): GlobePaths {
  const path = geoPath(createProjection(size, view));
  return {
    sphere: path({ type: 'Sphere' }) ?? '',
    graticule: path(geoGraticule10()) ?? '',
    countries: countries.flatMap(country => {
      const outline = countryFeatures.get(country.n3);
      const d = outline ? path(outline) : null;
      return d ? [{ iso: country.iso, d }] : [];
    }),
  };
}

/** One country's outline for the highlight layer ('' when it has none or is out of view). */
export function countryPath(
  size: number,
  view: GlobeView,
  iso: string,
): string {
  const country = countryByIso(iso);
  const outline = country ? countryFeatures.get(country.n3) : undefined;
  return outline ? (geoPath(createProjection(size, view))(outline) ?? '') : '';
}
