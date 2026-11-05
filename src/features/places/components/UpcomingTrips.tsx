import { StyleSheet, View } from 'react-native';

import { useGroupTripsList } from '../../../shared/api/generated/group-trips/group-trips';
import type { GroupTripDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { formatTripStart } from '../../../shared/utils/format';

function spotsText(trip: GroupTripDto): string {
  if (trip.spotsLeft === null) {
    return t('tripEvents.discover.going', { count: trip.approvedCount });
  }
  return trip.spotsLeft > 0 ? t('tripEvents.discover.spotsLeft', { count: trip.spotsLeft }) : t('tripEvents.discover.full');
}

type Props = { placeId: string; locale: Locale; onOpen: (id: string) => void };

/** "Upcoming trips here" on the Place page (trip-events AC8): open upcoming trips; hidden when none. */
export function UpcomingTrips({ placeId, locale, onOpen }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const query = useGroupTripsList({ placeId, scope: 'upcoming' });
  const items = query.data?.items ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <View testID="place.upcoming" style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('tripEvents.discover.placeTitle')}
      </AppText>
      {items.map(trip => {
        const line = `${formatTripStart(new Date(trip.startAt), locale)} · ${spotsText(trip)}`;
        return (
          <Pressable
            key={trip.id}
            testID={`place.upcoming-trip-${trip.id}`}
            accessibilityRole="button"
            accessibilityLabel={line}
            onPress={() => onOpen(trip.id)}
            style={[layout.row, styles.row]}
          >
            <AppText variant="body" style={layout.copy}>
              {line}
            </AppText>
            <Icon name="chevron" color={colors.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[10], marginTop: spacing[16] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[10], padding: spacing[12], borderRadius: radii.card, borderWidth: borders.card },
  copy: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
}));
