/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const TASHKENT_TZ = 'Asia/Tashkent';

/** A group trip starts at most this many Tashkent days ahead (AC1). */
export const PLAN_AHEAD_DAYS = 60;
/** Overnight cap for the inline check; the server's config still decides via 422. */
export const MAX_DURATION_H = 72;
export const MAX_BACK_DAYS = Math.ceil(MAX_DURATION_H / 24);

/** Wall-clock time in Tashkent. */
export type Clock = { h: number; m: number };

export const DEFAULT_START: Clock = { h: 7, m: 0 };
export const DEFAULT_BACK_BY: Clock = { h: 17, m: 30 };

/** A trip window: Tashkent days (`YYYY-MM-DD`) plus wall-clock times. */
export type TripWindow = { day: string; start: Clock; backDay: string; backBy: Clock };

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function tashkentDay(instant: Date): string {
  return new Date(instant.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

export function tashkentClock(instant: Date): Clock {
  const shifted = new Date(instant.getTime() + TASHKENT_OFFSET_MS);
  return { h: shifted.getUTCHours(), m: shifted.getUTCMinutes() };
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function toInstant(day: string, clock: Clock): Date {
  return new Date(`${day}T${pad(clock.h)}:${pad(clock.m)}:00+05:00`);
}

/** "HH:MM" for the API (carpool time). */
export function clockText(clock: Clock): string {
  return `${pad(clock.h)}:${pad(clock.m)}`;
}

export function parseClock(text: string): Clock {
  const [h, m] = text.split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

export type TimesError = 'timesInvalid' | 'startPast';

/** Inline check: back by after start and within the cap; start not in the past. */
export function timesError(window: TripWindow, now: Date): TimesError | null {
  const startAt = toInstant(window.day, window.start);
  const duration = toInstant(window.backDay, window.backBy).getTime() - startAt.getTime();
  if (duration <= 0 || duration > MAX_DURATION_H * HOUR_MS) {
    return 'timesInvalid';
  }
  return startAt.getTime() < now.getTime() ? 'startPast' : null;
}

/** The native pickers work in device-local time: the same wall-clock reading goes in and comes out. */
export function toPickerDate(day: string, clock: Clock): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, date ?? 1, clock.h, clock.m);
}

export function fromPickerDate(value: Date): { day: string; clock: Clock } {
  return {
    day: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    clock: { h: value.getHours(), m: value.getMinutes() },
  };
}

export function formatClock(instant: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TASHKENT_TZ,
  }).format(instant);
}

/** "Sat, 10 Oct" for a Tashkent day. */
export function formatDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}
