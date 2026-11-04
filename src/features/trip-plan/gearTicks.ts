import { GearKey } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';

const gearKeys: readonly string[] = Object.values(GearKey);

function isGearKey(value: unknown): value is GearKey {
  return typeof value === 'string' && gearKeys.includes(value);
}

/** Ticks for a new plan of one place, before it has a trip id (AC5). */
export function draftTicksId(placeId: string): string {
  return `draft.${placeId}`;
}

/** Packed gear on this device only (spec Q5), keyed by a draft id or a trip id. */
export function readTicks(id: string): GearKey[] {
  const raw = storage.getString(`trip.gear.${id}`);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGearKey) : [];
  } catch {
    // A corrupt entry is dropped: ticks are a convenience and never block a trip.
    storage.remove(`trip.gear.${id}`);
    return [];
  }
}

export function writeTicks(id: string, keys: GearKey[]): void {
  storage.setString(`trip.gear.${id}`, JSON.stringify(keys));
}

/** Once a draft becomes a trip, its ticks follow the trip id. */
export function moveTicks(fromId: string, toId: string): void {
  if (fromId === toId) {
    return;
  }
  const keys = readTicks(fromId);
  storage.remove(`trip.gear.${fromId}`);
  if (keys.length > 0) {
    writeTicks(toId, keys);
  }
}
