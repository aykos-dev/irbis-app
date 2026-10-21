import { storage } from '../../shared/storage';
import { haversineM } from './trackStore';

/** One offline check-in, as the API's CheckInWaypointDto takes it. */
export type QueuedWaypoint = { lat: number; lng: number; accuracyM: number; recordedAt: string };

/** A waypoint already logged (server) or waiting in the queue, for the local spacing check. */
type Logged = { lat: number; lng: number; recordedAt: string };

/** Offline spacing rules, the same as the server's trip.waypoint config (AC6). */
export const MIN_SPACING_M = 500;
export const MIN_INTERVAL_MIN = 10;
export const MAX_PER_TRIP = 5;

export const waypointCodes = {
  tooClose: 'WAYPOINT_TOO_CLOSE',
  tooSoon: 'WAYPOINT_TOO_SOON',
  inaccurate: 'LOCATION_INACCURATE',
  limit: 'WAYPOINT_LIMIT',
} as const;

export type WaypointRejection = { code: string; details?: Record<string, number> };

const KEY = 'active.waypointQueue';
const MINUTE_MS = 60_000;

function isQueued(value: unknown): value is QueuedWaypoint {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    typeof value.lat === 'number' &&
    'lng' in value &&
    typeof value.lng === 'number' &&
    'accuracyM' in value &&
    typeof value.accuracyM === 'number' &&
    'recordedAt' in value &&
    typeof value.recordedAt === 'string'
  );
}

/** This trip's queued check-ins in order; another trip's or an unreadable queue counts as empty. */
export function loadQueue(tripId: string): QueuedWaypoint[] {
  const raw = storage.getString(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('tripId' in parsed) ||
      parsed.tripId !== tripId ||
      !('items' in parsed) ||
      !Array.isArray(parsed.items)
    ) {
      return [];
    }
    return parsed.items.filter(isQueued);
  } catch {
    return [];
  }
}

export function saveQueue(tripId: string, items: QueuedWaypoint[]): void {
  if (items.length === 0) {
    storage.remove(KEY);
    return;
  }
  storage.setString(KEY, JSON.stringify({ tripId, items }));
}

/** At check-out the queue leaves the device. */
export function clearQueue(): void {
  storage.remove(KEY);
}

/**
 * The offline check (AC6): the server's rules against what is already logged on the device —
 * at most MAX_PER_TRIP, MIN_SPACING_M from the last one and MIN_INTERVAL_MIN after it.
 */
export function localRejection(logged: Logged[], fix: QueuedWaypoint): WaypointRejection | null {
  if (logged.length >= MAX_PER_TRIP) {
    return { code: waypointCodes.limit, details: { max: MAX_PER_TRIP } };
  }
  const last = logged[logged.length - 1];
  if (!last) {
    return null;
  }
  const distance = haversineM(last, fix);
  if (distance < MIN_SPACING_M) {
    return { code: waypointCodes.tooClose, details: { remainingM: Math.ceil(MIN_SPACING_M - distance) } };
  }
  const sinceMin = (Date.parse(fix.recordedAt) - Date.parse(last.recordedAt)) / MINUTE_MS;
  if (sinceMin < MIN_INTERVAL_MIN) {
    return { code: waypointCodes.tooSoon, details: { remainingMin: Math.ceil(MIN_INTERVAL_MIN - sinceMin) } };
  }
  return null;
}
