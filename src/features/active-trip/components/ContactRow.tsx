import { Share, StyleSheet, View } from 'react-native';

import type { TripDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { qaLog } from '../../../shared/utils/qaLog';
import { formatClock, minutesSince, placeName } from '../tripFormat';

type Props = { trip: TripDto; now: number; locale: Locale };

/** "{name} is following · …" from the server's lastLocationAt (AC3); under a minute is "just now". */
function followingLine(trip: TripDto, now: number): string {
  const name = trip.contact.name;
  if (!trip.lastLocationAt) {
    return t('active.contact.notYet', { name });
  }
  const min = minutesSince(trip.lastLocationAt, now);
  return min < 1 ? t('active.contact.justNow', { name }) : t('active.contact.following', { name, min });
}

/** Emergency contact row (AC3) with the live-link share (AC4, hidden without a link). */
export function ContactRow({ trip, now, locale }: Props) {
  const styles = useStyles();
  const { liveUrl } = trip;

  const share = async (url: string) => {
    const result = await Share.share({
      message: t('active.shareText', {
        place: placeName(trip.place, locale),
        time: formatClock(new Date(trip.backBy), locale),
        url,
      }),
    });
    if (result.action === Share.sharedAction) {
      qaLog('trip_live_shared', { tripId: trip.id });
    }
  };

  return (
    <View testID="active.contact" style={layout.row}>
      <View style={[styles.avatar, layout.avatar]} importantForAccessibility="no-hide-descendants">
        <AppText variant="h3" tone="white">
          {trip.contact.name.charAt(0).toUpperCase()}
        </AppText>
      </View>
      <AppText testID="active.contact.last-sent" variant="small" style={layout.fill}>
        {followingLine(trip, now)}
      </AppText>
      {liveUrl ? (
        <Pressable
          testID="active.share-live"
          accessibilityRole="button"
          accessibilityLabel={t('active.shareLive')}
          style={layout.share}
          onPress={() => void share(liveUrl)}
        >
          <Icon name="share" color={styles.icon.color} />
        </Pressable>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  avatar: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: sizes.iconTile / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { flex: 1 },
  share: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  avatar: { backgroundColor: c.teal },
  icon: { color: c.teal700 },
}));
