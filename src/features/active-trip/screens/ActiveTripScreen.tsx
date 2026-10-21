import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { errorMessageKey } from '../../../shared/api/errors';
import type { TripDto } from '../../../shared/api/generated/model';
import { getGetCurrentTripsQueryKey, useCheckOutTrip, useGetCurrentTrips } from '../../../shared/api/generated/trips/trips';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Mascot } from '../../../shared/components/Mascot';
import { OfflineBanner } from '../../../shared/components/OfflineBanner';
import { Skeleton } from '../../../shared/components/Skeleton';
import { toast } from '../../../shared/components/toastBus';
import { radii, screenPadding, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { CheckoutSheet } from '../components/CheckoutSheet';
import { ContactRow } from '../components/ContactRow';
import { StatsCard } from '../components/StatsCard';
import { TripMap } from '../components/TripMap';
import { useTripPings } from '../hooks/useTripPings';
import { useTripTracking } from '../hooks/useTripTracking';
import { clearTrack, type Track } from '../trackStore';

const MINUTE_MS = 60_000;
const SKELETON_CARD = 140;
/** API limits of the check-out totals (CheckOutTripDto). */
const MAX_DISTANCE_M = 1_000_000;
const MAX_CLIMB_M = 20_000;

const silent = { mutation: { meta: { silentError: true } } };

/** Wall-clock time that re-renders once a minute (elapsed, late, "min ago"). */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function totals(track: Track) {
  return {
    distanceM: Math.min(Math.round(track.distanceM), MAX_DISTANCE_M),
    climbM: Math.min(Math.round(track.climbM), MAX_CLIMB_M),
  };
}

/** Summary counts of a checked-out trip (AC8); waypoint XP joins with the check-in results of slice 2. */
function summaryOf(done: TripDto) {
  const end = done.checkedOutAt ? Date.parse(done.checkedOutAt) : Date.now();
  const start = done.startedAt ? Date.parse(done.startedAt) : end;
  return {
    tripId: done.id,
    distanceM: done.distanceM,
    climbM: done.climbM,
    durationMin: Math.max(0, Math.floor((end - start) / MINUTE_MS)),
    waypoints: done.waypoints.length,
    xp: 0,
  };
}

/**
 * Active trip (AC1–AC4, AC8): the live map, status and stats on top, the companion, contact row and
 * check-out at the bottom. Tracks and pings only while the trip is the current active one; if there
 * is none, goes back to Path.
 */
export function ActiveTripScreen({ navigation, route }: RootStackScreenProps<'ActiveTrip'>) {
  const { tripId } = route.params;
  const query = useGetCurrentTrips();
  const trip = query.data?.active?.id === tripId ? query.data.active : undefined;
  const gone = query.isSuccess && trip === undefined;
  const { track, permission } = useTripTracking(tripId, trip !== undefined);
  useTripPings(trip, track);
  const queryClient = useQueryClient();
  const checkOut = useCheckOutTrip(silent);
  const now = useMinuteClock();
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    qaLog('active_trip_open', { tripId });
  }, [tripId]);

  useEffect(() => {
    if (gone) {
      navigation.navigate('MainTabs', { screen: 'Path' });
    }
  }, [gone, navigation]);

  const confirmCheckOut = async (active: TripDto) => {
    try {
      const done = await checkOut.mutateAsync({ id: active.id, data: totals(track) });
      haptics.success();
      qaLog('trip_checked_out', { tripId: active.id, late: Date.now() > Date.parse(active.backBy), from: 'active' });
      clearTrack();
      navigation.replace('TripSummary', summaryOf(done));
      void queryClient.invalidateQueries({ queryKey: getGetCurrentTripsQueryKey() });
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
    }
  };

  let top;
  if (trip) {
    top = <StatsCard trip={trip} track={track} permission={permission} now={now} locale={locale} />;
  } else if (query.error) {
    top = (
      <View style={[styles.card, layout.card]}>
        <ErrorState
          testID="active.error"
          retryTestID="active.retry"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </View>
    );
  } else {
    top = <Skeleton testID="active.skeleton" height={SKELETON_CARD} radius={radii.card} />;
  }

  return (
    <View testID="active.screen" style={styles.root}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      {trip ? (
        <TripMap
          points={track.points}
          waypoints={trip.waypoints}
          last={track.last}
          fallback={{ lat: trip.place.latitude, lng: trip.place.longitude }}
        />
      ) : null}
      <View
        pointerEvents="box-none"
        style={[
          layout.top,
          {
            paddingTop: insets.top + spacing[8],
            paddingStart: screenPadding + insets.left,
            paddingEnd: screenPadding + insets.right,
          },
        ]}
      >
        {top}
        <OfflineBanner />
      </View>
      {trip ? (
        <View
          style={[
            styles.panel,
            layout.panel,
            {
              paddingBottom: insets.bottom + spacing[16],
              paddingStart: screenPadding + insets.left,
              paddingEnd: screenPadding + insets.right,
            },
          ]}
        >
          <View style={layout.companion}>
            <Mascot kind="fox" size={sizes.placeTypeDot} />
            <View style={layout.fill}>
              <ContactRow trip={trip} now={now} locale={locale} />
            </View>
          </View>
          <AppButton
            testID="active.checkout"
            variant="white"
            label={t('active.checkout.cta')}
            disabled={!isOnline || checkOut.isPending}
            onPress={() => setConfirming(true)}
          />
          {isOnline ? null : (
            <AppText testID="active.offline" variant="small" style={layout.center}>
              {t('active.offline')}
            </AppText>
          )}
        </View>
      ) : null}
      {trip && confirming ? (
        <CheckoutSheet
          contactName={trip.contact.name}
          pending={checkOut.isPending}
          disabled={!isOnline}
          onConfirm={() => void confirmCheckOut(trip)}
          onDismiss={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  top: { position: 'absolute', top: 0, start: 0, end: 0, gap: spacing[8] },
  card: { padding: spacing[16] },
  panel: {
    position: 'absolute',
    bottom: 0,
    start: 0,
    end: 0,
    paddingTop: spacing[16],
    gap: spacing[12],
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  companion: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  fill: { flex: 1 },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  card: { borderRadius: radii.card, backgroundColor: c.card },
  panel: { backgroundColor: c.card },
}));
