import { useInfiniteQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { getGroupTripsListQueryKey, groupTripsList } from '../../../shared/api/generated/group-trips/group-trips';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { TripRow } from '../components/TripRow';

const ROW_HEIGHT = 88;
const PARAMS = { scope: 'upcoming' } as const;

/** "See all" from Groups (trip-events AC8): every upcoming trip the viewer can see, page by page. */
export function GroupTripsScreen({ navigation }: RootStackScreenProps<'GroupTrips'>) {
  const locale = useLocale();
  const { colors } = useTheme();
  const styles = useStyles();
  const query = useInfiniteQuery({
    queryKey: [...getGroupTripsListQueryKey(PARAMS), 'all'],
    queryFn: ({ pageParam, signal }) =>
      groupTripsList({ ...PARAMS, ...(pageParam ? { cursor: pageParam } : {}) }, undefined, signal),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor,
  });
  const trips = query.data?.pages.flatMap(page => page.items) ?? [];

  let body;
  if (query.data) {
    body = trips.length ? (
      <View style={layout.list}>
        {trips.map(trip => (
          <TripRow
            key={trip.id}
            trip={trip}
            locale={locale}
            testID={`group-trips.trip-${trip.id}`}
            onPress={() => navigation.navigate('GroupTrip', { id: trip.id })}
          />
        ))}
        {query.hasNextPage ? (
          <AppButton
            testID="group-trips.more"
            variant="white"
            label={t('tripEvents.discover.loadMore')}
            loading={query.isFetchingNextPage}
            onPress={() => void query.fetchNextPage()}
          />
        ) : null}
      </View>
    ) : (
      <EmptyState
        testID="group-trips.empty"
        mascot="default"
        mascotLabel={t('tripEvents.discover.empty')}
        title={t('tripEvents.discover.empty')}
      />
    );
  } else if (query.error) {
    body = (
      <ErrorState testID="group-trips.error" retryTestID="group-trips.retry" error={query.error} onRetry={() => void query.refetch()} />
    );
  } else {
    body = (
      <View testID="group-trips.skeleton" style={layout.list}>
        <Skeleton height={ROW_HEIGHT} radius={radii.card} />
        <Skeleton height={ROW_HEIGHT} radius={radii.card} />
      </View>
    );
  }

  return (
    <Screen testID="group-trips.screen" scroll showOfflineBanner>
      <View style={layout.header}>
        <Pressable
          testID="group-trips.back"
          accessibilityRole="button"
          accessibilityLabel={t('places.back')}
          onPress={navigation.goBack}
          style={styles.back}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1" accessibilityRole="header" style={layout.title}>
          {t('tripEvents.discover.allTitle')}
        </AppText>
      </View>
      {body}
    </Screen>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  title: { flex: 1 },
  list: { gap: spacing[10] },
});

const useStyles = createThemedStyles(c => ({
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: borders.card,
    borderColor: c.line,
  },
}));
