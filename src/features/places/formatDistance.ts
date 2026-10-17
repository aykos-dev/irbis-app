const METRES_PER_KM = 1000;
const ONE_DECIMAL_BELOW_KM = 10;

/**
 * Distance number in km, locale digits (AC7): under 10 km one decimal, otherwise whole km. The
 * unit comes from the `places.distanceKm` copy.
 */
export function formatDistance(distanceM: number, locale: string): string {
  const km = distanceM / METRES_PER_KM;
  const digits = km < ONE_DECIMAL_BELOW_KM ? 1 : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(km);
}
