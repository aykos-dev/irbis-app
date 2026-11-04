import { StyleSheet, View } from 'react-native';

import type { GearItemDto, GearKey } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Checkbox } from '../../../shared/components/Checkbox';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { formatClock } from '../tripTimes';

type Props = {
  items: GearItemDto[];
  ticks: GearKey[];
  locale: string;
  onToggle: (key: GearKey, checked: boolean) => void;
};

function gearLabel(item: GearItemDto, locale: string): string {
  const label = t(`trip.gear.${item.key}`, { litres: item.litres ?? 0 });
  if (!item.note) {
    return label;
  }
  const note =
    item.note === 'sunset' && item.noteTime
      ? t('trip.gearNote.sunset', { time: formatClock(new Date(item.noteTime), locale) })
      : t(`trip.gearNote.${item.note}`, { time: '' });
  return `${label} · ${note}`;
}

/** Recommended gear from the preview (AC5): ticks live on the device and never block Start. */
export function GearList({ items, ticks, locale, onToggle }: Props) {
  const packed = items.filter(item => ticks.includes(item.key)).length;
  return (
    <View style={layout.wrap}>
      <View style={layout.head}>
        <AppText variant="h3" accessibilityRole="header">
          {t('trip.gearTitle')}
        </AppText>
        <AppText testID="trip.gear.count" variant="small">
          {t('trip.gearCount', { packed, total: items.length })}
        </AppText>
      </View>
      {items.map(item => (
        <Checkbox
          key={item.key}
          testID={`trip.gear.${item.key}`}
          label={gearLabel(item, locale)}
          checked={ticks.includes(item.key)}
          onChange={checked => onToggle(item.key, checked)}
        />
      ))}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[12] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
});
