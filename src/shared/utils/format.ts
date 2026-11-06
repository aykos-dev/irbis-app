/** Locale-aware formatting via Intl (engineering-standards §13). Never hand-rolled. */
export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Whole number with the locale's thousands separator (1,000 · 1 000). */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** "Sat, Oct 10 · 05:30" for a trip start, in Tashkent time (trip-events discovery rows). */
export function formatTripStart(instant: Date, locale: string): string {
  const timeZone = 'Asia/Tashkent';
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(instant);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(instant);
  return `${day} · ${time}`;
}
