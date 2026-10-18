import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon, type IconName } from '../../../shared/components/Icon';
import { palette } from '../../../shared/constants/colors';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import type { Locale } from '../../../shared/i18n';
import { formatNumber } from '../../../shared/utils/format';

const BAR_HEIGHT = spacing[10];

type Props = {
  testID: string;
  icon: IconName;
  tileColor: string;
  barColor: string;
  label: string;
  current: number;
  required: number;
  locale: Locale;
  note?: string;
};

/** Share of a bar that is filled: 0…1 (AC5). */
export function barFraction(current: number, required: number): number {
  if (required <= 0) {
    return 1;
  }
  return Math.min(Math.max(current / required, 0), 1);
}

/** One requirement towards the next level: icon tile, label, "current / required" and a bar. */
export function RequirementRow({ testID, icon, tileColor, barColor, label, current, required, locale, note }: Props) {
  const styles = useStyles();
  const value = `${formatNumber(current, locale)} / ${formatNumber(required, locale)}`;
  const width = `${barFraction(current, required) * 100}%` as const;
  return (
    <View testID={testID} style={layout.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <View style={[layout.tile, { backgroundColor: tileColor }]}>
        <Icon name={icon} color={palette.white} />
      </View>
      <View style={layout.body}>
        <View style={layout.head}>
          <AppText variant="small" tone="ink" style={layout.label}>
            {label}
          </AppText>
          <AppText testID={`${testID}-value`} variant="small" tone="muted">
            {value}
          </AppText>
        </View>
        <View style={styles.track}>
          <View testID={`${testID}-bar`} style={[layout.fill, { width, backgroundColor: barColor }]} />
        </View>
        {note ? (
          <AppText variant="small" tone="muted">
            {note}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[12], alignItems: 'flex-start' },
  tile: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing[6] },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[8] },
  label: { flexShrink: 1 },
  fill: { height: BAR_HEIGHT, borderRadius: radii.pill },
});

const useStyles = createThemedStyles(c => ({
  track: { height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: c.soft, overflow: 'hidden' },
}));
