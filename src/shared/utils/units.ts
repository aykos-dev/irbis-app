import type { Units } from '../api/generated/model';
import { storage } from '../storage';

const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.28084;

export function getStoredUnits(): Units {
  return storage.getString('prefs.units') === 'imperial'
    ? 'imperial'
    : 'metric';
}

export function setStoredUnits(units: Units): void {
  storage.setString('prefs.units', units);
}

export function formatDistance(
  metres: number,
  units = getStoredUnits(),
): string {
  const distance =
    units === 'imperial' ? metres / METRES_PER_MILE : metres / 1000;
  const value =
    distance < 10 ? distance.toFixed(1) : Math.round(distance).toString();
  return `${value} ${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatElevation(
  metres: number,
  units = getStoredUnits(),
): string {
  const value =
    units === 'imperial'
      ? Math.round(metres * FEET_PER_METRE)
      : Math.round(metres);
  return `${value} ${units === 'imperial' ? 'ft' : 'm'}`;
}
