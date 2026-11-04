import { geoContains } from 'd3-geo';

import { EARTH_RADIUS_KM, haversineKm, type LatLng } from '../../../../shared/utils/geo';
import {
  cities,
  countries,
  countryByIso,
  countryFeatures,
  microstateByIso,
} from './geoData';

export type GeoMode =
  | 'findCountry'
  | 'capitalToCountry'
  | 'countryToCapital'
  | 'cityDistance';

export type GuessScore = { km: number | null; points: number };

/** A guess this close to a microstate's centroid counts as inside it. */
const MICROSTATE_RADIUS_KM = 25;

type Vec = [number, number, number];

const toRad = (deg: number) => (deg * Math.PI) / 180;

const toVec = (latDeg: number, lngDeg: number): Vec => {
  const phi = toRad(latDeg);
  const lambda = toRad(lngDeg);
  return [
    Math.cos(phi) * Math.cos(lambda),
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
  ];
};

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Central angle in radians between two unit vectors. */
const angle = (a: Vec, b: Vec) =>
  Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));

/**
 * Angular distance from `q` to the great-circle arc `a`→`b` (all unit vectors). Works on the
 * sphere, so segments touching the antimeridian (Russia, Fiji) need no special case.
 */
function angleToArc(q: Vec, a: Vec, b: Vec): number {
  const n = cross(a, b);
  const nLen = Math.hypot(...n);
  const toEnds = Math.min(angle(q, a), angle(q, b));
  if (nLen < 1e-12) {
    return toEnds;
  }
  const unit: Vec = [n[0] / nLen, n[1] / nLen, n[2] / nLen];
  const off = dot(q, unit);
  // Foot of the perpendicular on the great circle; inside the arc when it sits between a and b.
  const foot: Vec = [q[0] - off * unit[0], q[1] - off * unit[1], q[2] - off * unit[2]];
  const between =
    dot(cross(a, foot), unit) >= 0 && dot(cross(foot, b), unit) >= 0;
  return between ? Math.min(Math.asin(Math.min(1, Math.abs(off))), toEnds) : toEnds;
}

/** Great-circle km between two points, rounded. */
export function kmBetween(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b));
}

function kmToBoundary(point: LatLng, rings: GeoJSON.Position[][]): number {
  const q = toVec(point.lat, point.lng);
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const from = ring[i - 1];
      const to = ring[i];
      if (from && to) {
        const a = toVec(from[1] ?? 0, from[0] ?? 0);
        const b = toVec(to[1] ?? 0, to[0] ?? 0);
        best = Math.min(best, angleToArc(q, a, b));
      }
    }
  }
  return best * EARTH_RADIUS_KM;
}

/**
 * km from a guess to a country: 0 inside its outline (or within 25 km of a microstate's centroid),
 * otherwise the shortest km to its boundary. A microstate missing from the 110m outlines is
 * measured to its centroid. `null` for an unknown country.
 */
export function kmToCountry(point: LatLng, iso: string): number | null {
  const country = countryByIso(iso);
  if (!country) {
    return null;
  }
  const micro = microstateByIso(country.iso);
  const centroidKm = micro ? haversineKm(point, micro) : Infinity;
  if (centroidKm <= MICROSTATE_RADIUS_KM) {
    return 0;
  }
  const shape = countryFeatures.get(country.n3);
  if (!shape) {
    return Number.isFinite(centroidKm) ? Math.round(centroidKm) : null;
  }
  if (geoContains(shape, [point.lng, point.lat])) {
    return 0;
  }
  const rings =
    shape.geometry.type === 'Polygon'
      ? shape.geometry.coordinates
      : shape.geometry.coordinates.flat();
  return Math.round(kmToBoundary(point, rings));
}

export const countryPoints = (km: number) =>
  Math.round(1000 * Math.exp(-km / 1500));

export const cityPoints = (km: number) =>
  Math.round(5000 * Math.exp(-km / 2000));

const noScore: GuessScore = { km: null, points: 0 };

/** Score for one guess; `null` guess (timeout) or unknown prompt → 0 points. */
export function scoreGuess(
  mode: GeoMode,
  promptId: string,
  guess: LatLng | null,
): GuessScore {
  if (!guess) {
    return noScore;
  }
  if (mode === 'cityDistance') {
    const city = cities.find(item => item.id === promptId);
    if (!city) {
      return noScore;
    }
    const km = kmBetween(guess, city);
    return { km, points: cityPoints(km) };
  }
  const country = countries.find(item => item.id === promptId);
  if (!country) {
    return noScore;
  }
  const km =
    mode === 'countryToCapital'
      ? kmBetween(guess, country.capital)
      : kmToCountry(guess, country.iso);
  return km === null ? noScore : { km, points: countryPoints(km) };
}
