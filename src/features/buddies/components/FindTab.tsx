import { useNavigation } from '@react-navigation/native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import {
  buddiesFind,
  getBuddiesFindQueryKey,
  getMeGetAvailabilityQueryKey,
  useMeGetAvailability,
  useMePutAvailability,
} from '../../../shared/api/generated/buddies/buddies';
import {
  Interest,
  type AvailabilityDto,
  type BuddiesFindParams,
  type BuddyLevelFilter,
} from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Skeleton } from '../../../shared/components/Skeleton';
import { toast } from '../../../shared/components/toastBus';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { buddyErrorKey } from '../errors';
import { useBuddyActions } from '../hooks/useBuddyActions';
import { regionName } from '../labels';
import { BuddyCard } from './BuddyCard';
import { Chip } from './Chip';

const CARD_HEIGHT = 150;
const MENTOR_LEVEL = 5;
const MIN_LEVEL = 1;
const MAX_LEVEL = 7;
const LEVELS: BuddyLevelFilter[] = ['any', 'near', 'mentors'];
const ALL_INTERESTS = Object.values(Interest);

type Day = 'sat' | 'sun';

/** Find buddies (AC1–AC3): weekend toggles, filters, match count and cards, page by page. */
export function FindTab({ header }: { header: React.ReactElement }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const actions = useBuddyActions();
  const [level, setLevel] = useState<BuddyLevelFilter>('any');
  const [weekend, setWeekend] = useState(false);
  const [byRegion, setByRegion] = useState(false);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [requested, setRequested] = useState<ReadonlySet<string>>(new Set());

  const myLevel = user?.level ?? MIN_LEVEL;
  const myRegion = user?.preferences?.showHomeRegion ? user.homeRegion : null;
  const interestChips = user?.interests?.length ? user.interests : ALL_INTERESTS;
  const params: BuddiesFindParams = {
    level,
    ...(weekend ? { weekend: true } : {}),
    ...(byRegion && myRegion ? { region: myRegion } : {}),
    ...(interests.length ? { interests: interests.join(',') } : {}),
  };
  const query = useInfiniteQuery({
    queryKey: [...getBuddiesFindQueryKey(params), 'pages'],
    queryFn: ({ pageParam, signal }) =>
      buddiesFind({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, undefined, signal),
    initialPageParam: null as string | null,
    getNextPageParam: page => page.nextCursor,
  });
  const people = query.data?.pages.flatMap(page => page.items) ?? [];
  const matchCount = query.data?.pages[0]?.matchCount;

  const toggleInterest = (interest: Interest) =>
    setInterests(current =>
      current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest],
    );

  const levelLabel = (option: BuddyLevelFilter) =>
    option === 'near'
      ? t('buddies.find.near', { lo: Math.max(myLevel - 1, MIN_LEVEL), hi: Math.min(myLevel + 1, MAX_LEVEL) })
      : t(option === 'any' ? 'buddies.find.any' : 'buddies.find.mentors', { n: MENTOR_LEVEL });

  const filters = (
    <View style={layout.header}>
      {header}
      <Availability disabled={!isOnline} />
      <AppText variant="caption" tone="muted">
        {t('buddies.find.level')}
      </AppText>
      <View style={layout.chips}>
        {LEVELS.map(option => (
          <Chip
            key={option}
            testID={`buddies.filter-level-${option}`}
            label={levelLabel(option)}
            selected={level === option}
            onPress={() => setLevel(option)}
          />
        ))}
      </View>
      <View style={layout.chips}>
        <Chip
          testID="buddies.filter-weekend"
          label={t('buddies.find.weekend')}
          selected={weekend}
          onPress={() => setWeekend(value => !value)}
        />
        {myRegion ? (
          <Chip
            testID="buddies.filter-region"
            label={regionName(myRegion)}
            selected={byRegion}
            onPress={() => setByRegion(value => !value)}
          />
        ) : null}
      </View>
      <View style={layout.chips}>
        {interestChips.map(interest => (
          <Chip
            key={interest}
            testID={`buddies.filter-interest-${interest}`}
            label={t(`onboarding.interests.${interest}`)}
            selected={interests.includes(interest)}
            onPress={() => toggleInterest(interest)}
          />
        ))}
      </View>
      {matchCount !== undefined ? (
        <AppText testID="buddies.match-count" variant="caption" tone="muted">
          {t('buddies.find.match', { count: matchCount })}
        </AppText>
      ) : null}
    </View>
  );

  let empty;
  if (query.error) {
    empty = (
      <ErrorState testID="buddies.find-error" retryTestID="buddies.find-retry" error={query.error} onRetry={() => void query.refetch()} />
    );
  } else if (query.data) {
    empty = (
      <EmptyState
        inline
        testID="buddies.find-empty"
        mascot="default"
        mascotLabel={t('buddies.find.empty')}
        title={t('buddies.find.empty')}
      />
    );
  } else {
    empty = (
      <View testID="buddies.find-skeleton" style={layout.list}>
        <Skeleton height={CARD_HEIGHT} radius={radii.card} />
        <Skeleton height={CARD_HEIGHT} radius={radii.card} />
      </View>
    );
  }

  return (
    <FlatList
      testID="buddies.find-list"
      data={people}
      keyExtractor={person => person.userId}
      ListHeaderComponent={filters}
      ListEmptyComponent={empty}
      ListFooterComponent={
        query.isFetchingNextPage ? <Skeleton height={CARD_HEIGHT} radius={radii.card} /> : undefined
      }
      contentContainerStyle={layout.list}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      }}
      renderItem={({ item }) => (
        <BuddyCard
          person={item}
          requested={requested.has(item.userId)}
          disabled={!isOnline || actions.adding}
          onOpen={() => navigation.navigate('PublicProfile', { username: item.username, userId: item.userId })}
          onAdd={() => actions.add(item.userId, () => setRequested(current => new Set(current).add(item.userId)))}
        />
      )}
    />
  );
}

/** "I'm free this weekend: Sat / Sun" (AC3), optimistic with rollback. */
function Availability({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient();
  const availability = useMeGetAvailability();
  const put = useMePutAvailability({ mutation: { meta: { silentError: true } } });
  const key = getMeGetAvailabilityQueryKey();

  const toggle = async (day: Day) => {
    const previous = queryClient.getQueryData<AvailabilityDto>(key) ?? availability.data;
    if (!previous) {
      return;
    }
    const next = { ...previous, [day]: !previous[day] };
    queryClient.setQueryData(key, next);
    try {
      queryClient.setQueryData(key, await put.mutateAsync({ data: { sat: next.sat, sun: next.sun } }));
      haptics.success();
      toast.show({ variant: 'success', message: t('buddies.find.saved') });
    } catch (error) {
      queryClient.setQueryData(key, previous);
      haptics.error();
      toast.show({ variant: 'error', message: t(buddyErrorKey(error)) });
    }
  };

  const data = availability.data;
  return (
    <View style={layout.free}>
      <AppText variant="h3">{t('buddies.find.free')}</AppText>
      <View style={layout.chips}>
        {(['sat', 'sun'] as const).map(day => (
          <Chip
            key={day}
            testID={`buddies.free-${day}`}
            label={t(`buddies.find.${day}`)}
            selected={data?.[day] ?? false}
            disabled={disabled || !data}
            onPress={() => void toggle(day)}
          />
        ))}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  header: { gap: spacing[10], paddingBottom: spacing[6] },
  list: { gap: spacing[12], paddingBottom: spacing[20] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  free: { gap: spacing[8] },
});
