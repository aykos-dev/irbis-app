/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's date in Tashkent, `YYYY-MM-DD`. */
export function tashkentDay(now: number = Date.now()): string {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Milliseconds until the next 00:00 in Tashkent. */
export function msUntilTashkentMidnight(now: number = Date.now()): number {
  const local = now + TASHKENT_OFFSET_MS;
  return DAY_MS - (((local % DAY_MS) + DAY_MS) % DAY_MS);
}
