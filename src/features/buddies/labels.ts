import type { BuddyFreeDto, BuddyPlaceNamesDto, HomeRegion } from '../../shared/api/generated/model';
import { levelMeta } from '../../shared/components/levels/levelMeta';
import { t, type Locale } from '../../shared/i18n';

export function personName(person: { username: string; displayName: string | null }): string {
  return person.displayName ?? person.username;
}

export function regionName(region: HomeRegion): string {
  return t(`buddies.regions.${region}`);
}

export function levelName(level: number): string {
  return t(levelMeta(level).nameKey);
}

/** "Free Sat" / "Free Sun" / "Free Sat–Sun", or null when busy both days. */
export function freeLabel(free: BuddyFreeDto): string | null {
  if (free.sat && free.sun) {
    return t('buddies.card.freeBoth');
  }
  if (free.sat) {
    return t('buddies.card.freeSat');
  }
  return free.sun ? t('buddies.card.freeSun') : null;
}

/** The place name in the app language (the API falls back to uz). */
export function localName(names: BuddyPlaceNamesDto, locale: Locale): string {
  return names[locale];
}

/** "21 October" in Tashkent time (rating close date). */
export function formatCloseDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'Asia/Tashkent' }).format(new Date(value));
}

/** A trait average with one decimal (4.3 · 4,3). */
export function formatScore(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}
