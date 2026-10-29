import type { CreateCheckInDto } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';

/** AC5: at most this many check-ins wait on the phone; the oldest goes first when full. */
export const MAX_QUEUED = 20;

/** AC4: the fix must be at least this accurate (server `checkIn.maxAccuracyM`). */
export const MAX_ACCURACY_M = 50;

const KEY = 'checkIn.queue';
const EARTH_RADIUS_M = 6_371_000;
const METRES_PER_KM = 1000;

function isQueued(value: unknown): value is CreateCheckInDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'clientId' in value &&
    typeof value.clientId === 'string' &&
    'placeId' in value &&
    typeof value.placeId === 'string' &&
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

/** Queued check-ins, oldest first; an unreadable queue counts as empty. */
export function loadQueue(): CreateCheckInDto[] {
  const raw = storage.getString(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isQueued) : [];
  } catch {
    return [];
  }
}

export function saveQueue(items: CreateCheckInDto[]): void {
  if (items.length === 0) {
    storage.remove(KEY);
    return;
  }
  storage.setString(KEY, JSON.stringify(items.slice(-MAX_QUEUED)));
}

const queuedListeners = new Set<() => void>();

/** Calls `listener` after each new check-in is queued; returns the unsubscribe. */
export function onQueued(listener: () => void): () => void {
  queuedListeners.add(listener);
  return () => {
    queuedListeners.delete(listener);
  };
}

/** Appends one check-in; past MAX_QUEUED the oldest is dropped. */
export function enqueue(item: CreateCheckInDto): void {
  saveQueue([...loadQueue(), item]);
  queuedListeners.forEach(listener => listener());
}

/** Drops one check-in (sent or rejected) by its clientId. */
export function removeQueued(clientId: string): void {
  saveQueue(loadQueue().filter(item => item.clientId !== clientId));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (the server's check, AC1). */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Distance as a number with its unit key: km with one decimal from 1000 m, else whole metres. */
export function distanceParts(metres: number, locale: string): { key: 'checkin.km' | 'checkin.m'; n: string } {
  if (metres >= METRES_PER_KM) {
    const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
      metres / METRES_PER_KM,
    );
    return { key: 'checkin.km', n };
  }
  return { key: 'checkin.m', n: new Intl.NumberFormat(locale).format(Math.round(metres)) };
}
