import type { Units } from '../api/generated/model';
import { getLocale, type Locale } from '../i18n';
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
  locale: Locale = getLocale(),
): string {
  const distance =
    units === 'imperial' ? metres / METRES_PER_MILE : metres / 1000;
  const value = new Intl.NumberFormat(
    locale,
    distance < 10
      ? { minimumFractionDigits: 1, maximumFractionDigits: 1 }
      : { maximumFractionDigits: 0 },
  ).format(distance);
  return `${value} ${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatElevation(
  metres: number,
  units = getStoredUnits(),
  locale: Locale = getLocale(),
): string {
  const value =
    units === 'imperial'
      ? Math.round(metres * FEET_PER_METRE)
      : Math.round(metres);
  return `${new Intl.NumberFormat(locale).format(value)} ${units === 'imperial' ? 'ft' : 'm'}`;
}
