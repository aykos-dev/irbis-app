/** Locale-aware formatting via Intl (engineering-standards §13). Never hand-rolled. */
export function formatTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}
