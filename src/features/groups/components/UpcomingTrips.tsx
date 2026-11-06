import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { useConditionsGetForPlace } from '../../../shared/api/generated/conditions/conditions';
import { useGroupTripsList } from '../../../shared/api/generated/group-trips/group-trips';
import type { GroupTripDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import { statusVariant } from '../../../shared/components/conditions/reasonText';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t, type Locale } from '../../../shared/i18n';
import { formatTripStart } from '../../../shared/utils/format';

const SHOWN = 5;

function spotsText(trip: GroupTripDto): string {
  if (trip.spotsLeft === null) {
    return t('tripEvents.discover.going', { count: trip.approvedCount });
  }
  return trip.spotsLeft > 0 ? t('tripEvents.discover.spotsLeft', { count: trip.spotsLeft }) : t('tripEvents.discover.full');
}

/** "Upcoming group trips" on Groups (trip-events AC8): open public trips and my groups' trips; hidden when none. */
export function UpcomingTrips() {
  const navigation = useNavigation();
  const locale = useLocale();
  const query = useGroupTripsList({ scope: 'upcoming' });
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  const more = items.length > SHOWN || query.data?.nextCursor !== null;
  return (
    <View testID="groups.upcoming" style={layout.section}>
      <View style={layout.head}>
        <AppText variant="chip" tone="muted" accessibilityRole="header">
          {t('tripEvents.discover.groupsTitle').toUpperCase()}
        </AppText>
        {more ? (
          <Pressable
            testID="groups.upcoming-see-all"
            accessibilityRole="button"
            accessibilityLabel={t('tripEvents.discover.seeAll')}
            onPress={() => navigation.navigate('GroupTrips')}
            style={layout.seeAll}
          >
            <AppText variant="chip" tone="teal700">
              {t('tripEvents.discover.seeAll')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {items.slice(0, SHOWN).map(trip => (
        <TripRow key={trip.id} trip={trip} locale={locale} onPress={() => navigation.navigate('GroupTrip', { id: trip.id })} />
      ))}
    </View>
  );
}

function TripRow({ trip, locale, onPress }: { trip: GroupTripDto; locale: Locale; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const condition = useConditionsGetForPlace(trip.place.id);
  const status = condition.data?.status;
  const name = trip.place.names[locale];
  const line = `${formatTripStart(new Date(trip.startAt), locale)} · ${spotsText(trip)}`;
  const testID = `groups.upcoming-trip-${trip.id}`;
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
      </View>
      {status ? (
        <StatusChip testID={`${testID}-condition`} variant={statusVariant[status]} label={t(`conditions.status.${status}`)} />
      ) : null}
      <Icon name="chevron" color={colors.muted} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[10] },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { minHeight: sizes.touchTarget, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[10], padding: spacing[12], borderRadius: radii.card, borderWidth: borders.card },
  copy: { flex: 1, gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
}));
