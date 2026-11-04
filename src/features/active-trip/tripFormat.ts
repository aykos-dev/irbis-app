import type { TripPlaceDto } from '../../shared/api/generated/model';
import type { Locale } from '../../shared/i18n';

/** Trip times are Tashkent wall-clock times (trip-plan spec), whatever the device zone. */
const TASHKENT_TZ = 'Asia/Tashkent';
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;
const METRES_PER_KM = 1000;

export function placeName(place: TripPlaceDto, locale: Locale): string {
  const names: Record<Locale, string | null> = { uz: place.nameUz, ru: place.nameRu, en: place.nameEn };
  return names[locale] ?? place.nameUz;
}

/** 24-hour Tashkent clock time ("17:30"). */
export function formatClock(instant: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TASHKENT_TZ,
  }).format(instant);
}

/** Kilometres with one decimal ("4.2"). */
export function formatKm(metres: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    metres / METRES_PER_KM,
  );
}

/** Whole metres with the locale's grouping. */
export function formatMetres(metres: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(metres);
}

/** Duration as h:mm ("2:05"); negative spans count as zero. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

/** Whole minutes since an ISO instant. */
export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / MINUTE_MS));
}
