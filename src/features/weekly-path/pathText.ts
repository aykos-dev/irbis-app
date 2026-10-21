import type { PathNodeDto, PathPlaceNameDto } from '../../shared/api/generated/model';
import { reasonText, statusVariant } from '../../shared/components/conditions/reasonText';
import type { StatusChipVariant } from '../../shared/components/StatusChip';
import { t, type Locale } from '../../shared/i18n';

export type NodeChip = { variant: StatusChipVariant; label: string };

/** Place name in the locale, falling back to uz. */
export function placeName(name: PathPlaceNameDto, locale: Locale): string {
  return name[locale] ?? name.uz;
}

/** A node's status chip (AC2): go · day, caution · reason, not now, opens in month; null → none. */
export function nodeChip(node: PathNodeDto, locale: Locale): NodeChip | null {
  if (!node.status) {
    return null;
  }
  const variant = statusVariant[node.status];
  switch (node.status) {
    case 'go':
      return { variant, label: t('path.status.go', { day: t(`path.days.${node.weekendDay}`) }) };
    case 'caution': {
      const reason = node.reasons
        .map(entry => reasonText(entry, locale))
        .find((line): line is string => line !== null);
      return {
        variant,
        label: reason ? t('path.status.caution', { reason }) : t('conditions.status.caution'),
      };
    }
    case 'not_now':
      return { variant, label: t('path.status.notNow') };
    case 'seasonal_lock':
      return {
        variant,
        label: node.opensMonth
          ? t('path.status.opens', { month: t(`path.monthsIn.${node.opensMonth}`) })
          : t('conditions.title.seasonal'),
      };
  }
}
