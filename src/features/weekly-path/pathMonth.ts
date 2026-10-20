/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MONTH_KEY_LENGTH = 7;

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/** The current month in Tashkent, `YYYY-MM` (the API's `month` format). */
export function tashkentMonth(now: number = Date.now()): string {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, MONTH_KEY_LENGTH);
}

/** `YYYY-MM` → 1…12. */
export function monthNumber(month: string): number {
  return Number(month.slice(month.indexOf('-') + 1));
}

const seasonByMonth: Record<number, Season> = {
  12: 'winter',
  1: 'winter',
  2: 'winter',
  3: 'spring',
  4: 'spring',
  5: 'spring',
  6: 'summer',
  7: 'summer',
  8: 'summer',
  9: 'autumn',
  10: 'autumn',
  11: 'autumn',
};

/** Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn (AC6). */
export function seasonOf(month: number): Season {
  return seasonByMonth[month] ?? 'winter';
}
