import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { getMePendingRatingsQueryKey } from '../../../shared/api/generated/buddies/buddies';
import {
  getGroupTripsPendingRatingsQueryKey,
  useGroupTripsPendingRatings,
  useGroupTripsRate,
} from '../../../shared/api/generated/group-trips/group-trips';
import type { TripRatingScoresDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { toast } from '../../../shared/components/toastBus';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { RateAttendeeCard } from '../components/RateAttendeeCard';
import { buddyErrorKey, hasCode } from '../errors';
import { formatCloseDate } from '../labels';

const SKELETON_CARD = 220;

/** Rate trip buddies (buddies AC7): three traits per other attendee, saved one person at a time. */
export function RateBuddiesScreen({ navigation, route }: RootStackScreenProps<'RateBuddies'>) {
  const { groupTripId } = route.params;
  const locale = useLocale();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const query = useGroupTripsPendingRatings(groupTripId);
  const rate = useGroupTripsRate({ mutation: { meta: { silentError: true } } });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [closedNow, setClosedNow] = useState(false);

  const save = async (userId: string, scores: TripRatingScoresDto): Promise<boolean> => {
    setSavingId(userId);
    try {
      await rate.mutateAsync({ id: groupTripId, userId, data: scores });
      haptics.success();
      toast.show({ variant: 'success', message: t('buddies.rate.savedToast') });
      void queryClient.invalidateQueries({ queryKey: getMePendingRatingsQueryKey() });
      return true;
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'error', message: t(buddyErrorKey(error)) });
      if (hasCode(error, 'RATING_CLOSED')) {
        setClosedNow(true);
      }
      return false;
    } finally {
      setSavingId(null);
      void queryClient.invalidateQueries({ queryKey: getGroupTripsPendingRatingsQueryKey(groupTripId) });
    }
  };

  const header = (
    <View style={layout.header}>
      <Pressable
        testID="rate.back"
        accessibilityRole="button"
        accessibilityLabel={t('buddies.back')}
        onPress={navigation.goBack}
      >
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <AppText variant="h1" accessibilityRole="header" style={layout.title}>
        {t('buddies.rate.title')}
      </AppText>
    </View>
  );

  const { data } = query;
  let body;
  if (data) {
    const closed = closedNow || new Date(data.closesAt).getTime() <= Date.now();
    const date = formatCloseDate(data.closesAt, locale);
    body = (
      <>
        <View style={layout.notes}>
          <AppText testID="rate.closes" variant="small" tone={closed ? 'red700' : 'muted'}>
            {t(closed ? 'buddies.rate.closed' : 'buddies.rate.closes', { date })}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('buddies.rate.anonymous')}
          </AppText>
        </View>
        {data.attendees.length === 0 ? (
          <EmptyState
            testID="rate.empty"
            mascot="sleepy"
            mascotLabel={t('buddies.rate.empty')}
            title={t('buddies.rate.empty')}
            inline
          />
        ) : (
          data.attendees.map(attendee => (
            <RateAttendeeCard
              key={attendee.userId}
              attendee={attendee}
              readOnly={closed || !isOnline}
              saving={savingId === attendee.userId}
              onSave={scores => save(attendee.userId, scores)}
            />
          ))
        )}
      </>
    );
  } else if (query.error) {
    body = (
      <ErrorState
        testID="rate.error"
        retryTestID="rate.retry"
        error={query.error}
        title={hasCode(query.error, 'NOT_ATTENDEE') ? t('buddies.errors.NOT_ATTENDEE') : undefined}
        onRetry={() => void query.refetch()}
      />
    );
  } else {
    body = (
      <View testID="rate.skeleton" style={layout.list}>
        <Skeleton height={SKELETON_CARD} radius={radii.card} />
        <Skeleton height={SKELETON_CARD} radius={radii.card} />
      </View>
    );
  }

  return (
    <Screen testID="rate.screen" scroll showOfflineBanner>
      <View style={layout.list}>
        {header}
        {body}
      </View>
    </Screen>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  title: { flex: 1 },
  notes: { gap: spacing[4] },
  list: { gap: spacing[16] },
});
