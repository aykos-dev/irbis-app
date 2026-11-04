import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Screen } from '../../../shared/components/Screen';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { formatDuration, formatKm, formatMetres } from '../tripFormat';

const MINUTE_MS = 60_000;

/** After check-out (AC8): distance, climb, time on the trail, waypoints and XP; Done goes to Path. */
export function TripSummaryScreen({ navigation, route }: RootStackScreenProps<'TripSummary'>) {
  const { distanceM, climbM, durationMin, waypoints, xp } = route.params;
  const locale = useLocale();
  const styles = useStyles();

  const rows = [
    { testID: 'summary.distance', value: formatKm(distanceM, locale), label: t('active.summary.distance') },
    { testID: 'summary.climb', value: `+${formatMetres(climbM, locale)}`, label: t('active.summary.climb') },
    { testID: 'summary.time', value: formatDuration(durationMin * MINUTE_MS), label: t('active.summary.time') },
    { testID: 'summary.waypoints', value: formatMetres(waypoints, locale), label: t('active.summary.waypoints') },
    { testID: 'summary.xp', value: `+${formatMetres(xp, locale)}`, label: t('active.summary.xp') },
  ];

  return (
    <Screen testID="summary.screen" scroll>
      <View style={layout.head}>
        <Mascot kind="fox" size={sizes.mascotCard} />
        <AppText variant="h1" accessibilityRole="header">
          {t('active.summary.title')}
        </AppText>
      </View>
      <View style={[styles.card, layout.card]}>
        {rows.map(row => (
          <View key={row.testID} style={layout.row} accessible accessibilityLabel={`${row.value} ${row.label}`}>
            <AppText testID={row.testID} variant="stat">
              {row.value}
            </AppText>
            <AppText variant="body">{row.label}</AppText>
          </View>
        ))}
      </View>
      <AppButton
        testID="summary.done"
        label={t('active.summary.done')}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Path' })}
      />
    </Screen>
  );
}

const layout = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing[12], paddingVertical: spacing[24] },
  card: { padding: spacing[16], gap: spacing[12], marginBottom: spacing[24] },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  card: { borderRadius: radii.card, borderWidth: borders.card, borderColor: c.line, backgroundColor: c.card },
}));
