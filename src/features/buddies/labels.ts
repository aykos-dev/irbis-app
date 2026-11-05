import type { BuddyFreeDto, HomeRegion } from '../../shared/api/generated/model';
import { levelMeta } from '../../shared/components/levels/levelMeta';
import { t } from '../../shared/i18n';

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
