/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SATURDAY = 6;
const SUNDAY = 0;
const WEEK = 7;

export const TASHKENT_TZ = 'Asia/Tashkent';
/** Plans can be saved this many days ahead (spec Q10). */
export const PLAN_AHEAD_DAYS = 14;
/** Overnight cap for the inline check (spec Q7); the server's config still decides via 422. */
export const MAX_DURATION_H = 72;
/** Back-by may land this many days after the start day. */
export const MAX_BACK_DAYS = Math.ceil(MAX_DURATION_H / 24);
/** Display-only alert time before the server returns `alertAt`. */
export const ALERT_DELAY_MIN = 60;

/** Wall-clock time in Tashkent. */
export type Clock = { h: number; m: number };

export const DEFAULT_START: Clock = { h: 7, m: 0 };
export const DEFAULT_BACK_BY: Clock = { h: 17, m: 30 };

/** A plan's window: Tashkent days (`YYYY-MM-DD`) plus wall-clock times. */
export type TripWindow = { day: string; start: Clock; backDay: string; backBy: Clock };

export type TimesError = 'timesInvalid' | 'startPast';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** The Tashkent calendar day of an instant, `YYYY-MM-DD`. */
export function tashkentDay(instant: Date): string {
  return new Date(instant.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** The Tashkent wall-clock time of an instant. */
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

function nextWeekday(today: string, weekday: number): string {
  const current = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, (weekday - current + WEEK) % WEEK);
}

/** Next Saturday / Sunday in Tashkent; today counts when it is that day (AC2). */
export function weekendDays(now: Date): { today: string; sat: string; sun: string } {
  const today = tashkentDay(now);
  return { today, sat: nextWeekday(today, SATURDAY), sun: nextWeekday(today, SUNDAY) };
}

/** The instant of a Tashkent day + wall-clock time. */
export function toInstant(day: string, clock: Clock): Date {
  return new Date(`${day}T${pad(clock.h)}:${pad(clock.m)}:00+05:00`);
}

export function windowInstants(window: TripWindow): { startAt: Date; backBy: Date } {
  return { startAt: toInstant(window.day, window.start), backBy: toInstant(window.backDay, window.backBy) };
}

/** Inline check (AC2): back-by after start and within the cap; start not in the past. */
export function timesError(window: TripWindow, now: Date): TimesError | null {
  const { startAt, backBy } = windowInstants(window);
  const duration = backBy.getTime() - startAt.getTime();
  if (duration <= 0 || duration > MAX_DURATION_H * HOUR_MS) {
    return 'timesInvalid';
  }
  if (startAt.getTime() < now.getTime()) {
    return 'startPast';
  }
  return null;
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}

/**
 * The native pickers work in device-local time: a Tashkent day + clock goes in as the same
 * wall-clock reading, and comes back out the same way, whatever the device's zone.
 */
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

/** "07:00" in Tashkent, locale digits. */
export function formatClock(instant: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TASHKENT_TZ,
  }).format(instant);
}

/** "Sat, 25 Oct" for a Tashkent day. */
export function formatDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

/** A new back-by for an active trip (AC7): after now and within the cap from the start. */
export function isValidNewBackBy(startAt: Date, backBy: Date, now: Date): boolean {
  return backBy.getTime() > now.getTime() && backBy.getTime() - startAt.getTime() <= MAX_DURATION_H * HOUR_MS;
}
