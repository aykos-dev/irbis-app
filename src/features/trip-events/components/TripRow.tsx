import { StyleSheet, View } from 'react-native';

import { useConditionsGetForPlace } from '../../../shared/api/generated/conditions/conditions';
import type { GroupTripDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import { statusVariant } from '../../../shared/components/conditions/reasonText';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { formatTripStart } from '../../../shared/utils/format';

/** "N spots left" · "Full" · "N going" when there is no cap. */
export function spotsText(trip: GroupTripDto): string {
  if (trip.spotsLeft === null) {
    return t('tripEvents.discover.going', { count: trip.approvedCount });
  }
  return trip.spotsLeft > 0 ? t('tripEvents.discover.spotsLeft', { count: trip.spotsLeft }) : t('tripEvents.discover.full');
}

type Props = { trip: GroupTripDto; locale: Locale; testID: string; onPress: () => void };

/** One upcoming trip: "Place · Sat, 10 Oct · 05:30 · N spots left" with the place's condition. */
export function TripRow({ trip, locale, testID, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const condition = useConditionsGetForPlace(trip.place.id);
  const status = condition.data?.status;
  const name = trip.place.names[locale];
  const line = `${formatTripStart(new Date(trip.startAt), locale)} · ${spotsText(trip)}`;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${name} · ${line}`}
      onPress={onPress}
      style={[layout.row, styles.row]}
    >
      <View style={layout.copy}>
        <AppText variant="h3">{name}</AppText>
        <AppText variant="small" tone="muted">
          {line}
        </AppText>
        {status ? (
          <View style={layout.chip}>
            <StatusChip testID={`${testID}-condition`} variant={statusVariant[status]} label={t(`conditions.status.${status}`)} />
          </View>
        ) : null}
      </View>
      <Icon name="chevron" color={colors.muted} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12], padding: spacing[12], borderRadius: radii.card, borderWidth: borders.card },
  copy: { flex: 1, gap: spacing[4] },
  chip: { flexDirection: 'row' },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
}));
