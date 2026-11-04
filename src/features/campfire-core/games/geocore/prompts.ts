import { drawIds, type Rng } from '../usedStore';
import { cities, countries } from './geoData';
import type { GeoMode } from './scoring';

/**
 * `count` distinct prompt ids for a round: countries for the three country modes, cities for City
 * distance. Skips ids already played on this phone (`camp.used.geo.<mode>`); the pack starts over
 * when too few are left.
 */
export function drawPrompts(
  mode: GeoMode,
  count = 10,
  rng: Rng = Math.random,
): string[] {
  const items = mode === 'cityDistance' ? cities : countries;
  return drawIds('geo', { id: mode, items }, count, rng);
}
