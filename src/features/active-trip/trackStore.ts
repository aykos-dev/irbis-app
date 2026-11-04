import { storage } from '../../shared/storage';

/** One GPS fix as the tracker keeps it. `alt` is null when the device gives no altitude. */
export type Fix = { lat: number; lng: number; alt: number | null; accuracyM: number; at: number };

/** The recorded route of one trip; `points` are [lng, lat] pairs for the map line. */
export type Track = {
  tripId: string;
  points: [number, number][];
  distanceM: number;
  climbM: number;
  anchorAlt: number | null;
  last: Fix | null;
};

/** Fixes less accurate than this are dropped (AC2). */
export const MAX_ACCURACY_M = 50;
/** Points kept on the device; when full, every second point is dropped. */
export const MAX_POINTS = 5000;
/** Altitude gain over the anchor that counts as climb (filters GPS noise). */
export const CLIMB_STEP_M = 3;

const KEY = 'active.track';
const XP_KEY = 'active.waypointXp';
const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two lat/lng points. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function emptyTrack(tripId: string): Track {
  return { tripId, points: [], distanceM: 0, climbM: 0, anchorAlt: null, last: null };
}

function nextClimb(track: Track, alt: number | null): Pick<Track, 'climbM' | 'anchorAlt'> {
  const { climbM, anchorAlt } = track;
  if (alt === null) {
    return { climbM, anchorAlt };
  }
  if (anchorAlt === null || alt < anchorAlt) {
    return { climbM, anchorAlt: alt };
  }
  const gain = alt - anchorAlt;
  return gain >= CLIMB_STEP_M ? { climbM: climbM + gain, anchorAlt: alt } : { climbM, anchorAlt };
}

/**
 * Adds one fix (AC2): inaccurate fixes are ignored (same track returned), distance grows by the
 * haversine step, climb counts only gains of at least CLIMB_STEP_M over the anchor altitude.
 */
export function applyFix(track: Track, fix: Fix): Track {
  if (fix.accuracyM > MAX_ACCURACY_M) {
    return track;
  }
  const step = track.last ? haversineM(track.last, fix) : 0;
  let points: [number, number][] = [...track.points, [fix.lng, fix.lat]];
  if (points.length > MAX_POINTS) {
    points = points.filter((_, index) => index % 2 === 0);
  }
  return { ...track, ...nextClimb(track, fix.alt), points, distanceM: track.distanceM + step, last: fix };
}

function isTrack(value: unknown, tripId: string): value is Track {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tripId' in value &&
    value.tripId === tripId &&
    'points' in value &&
    Array.isArray(value.points) &&
    'distanceM' in value &&
    typeof value.distanceM === 'number' &&
    'climbM' in value &&
    typeof value.climbM === 'number'
  );
}

/** The saved track of this trip, or an empty one (another trip's or an unreadable track is ignored). */
export function loadTrack(tripId: string): Track {
  const raw = storage.getString(KEY);
  if (!raw) {
    return emptyTrack(tripId);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isTrack(parsed, tripId) ? parsed : emptyTrack(tripId);
  } catch {
    return emptyTrack(tripId);
  }
}

export function saveTrack(track: Track): void {
  storage.setString(KEY, JSON.stringify(track));
}

/** XP the server granted for this trip's waypoint check-ins (never optimistic); 0 for another trip. */
export function loadWaypointXp(tripId: string): number {
  const raw = storage.getString(XP_KEY);
  if (!raw) {
    return 0;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' &&
      parsed !== null &&
      'tripId' in parsed &&
      parsed.tripId === tripId &&
      'xp' in parsed &&
      typeof parsed.xp === 'number'
      ? parsed.xp
      : 0;
  } catch {
    return 0;
  }
}

/** Adds one check-in's `xpAwarded` to the trip's total. */
export function addWaypointXp(tripId: string, xp: number): void {
  storage.setString(XP_KEY, JSON.stringify({ tripId, xp: loadWaypointXp(tripId) + xp }));
}

/** After check-out (AC2): the track and its waypoint XP leave the device (only one trip is ever stored). */
export function clearTrack(): void {
  storage.remove(KEY);
  storage.remove(XP_KEY);
}
