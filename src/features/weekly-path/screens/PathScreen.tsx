import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import type { MainTabScreenProps } from '../../../app/navigation/types';
import { useMeLevelGet } from '../../../shared/api/generated';
import type { PathDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { HowBuiltSheet } from '../components/HowBuiltSheet';
import { PathHeader } from '../components/PathHeader';
import { PathTrail } from '../components/PathTrail';
import { WeatherStrip } from '../components/WeatherStrip';
import { usePath } from '../hooks/usePath';
import { tashkentMonth } from '../pathMonth';
import type { PathDeps } from '../types';

const SKELETON_TRAIL = 420;

type Props = MainTabScreenProps<'Path'> & PathDeps;

/** Path tab (AC1, AC2, AC6–AC8): this month's three places, the weekend weather and the chest. */
export function PathScreen({ navigation, readInterests, placeType }: Props) {
  const locale = useLocale();
  const { colors } = useTheme();
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const query = usePath(readInterests);
  const { data, refetch } = query;
  // Read from the cache only: the header never adds a request of its own.
  const meLevel = useMeLevelGet({ query: { enabled: false } });
  const [sheet, setSheet] = useState<'open' | 'closing' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const shown = useRef<PathDto | undefined>(undefined);
  useEffect(() => {
    shown.current = data;
  }, [data]);

  // A path from an earlier Tashkent month is refetched when the tab comes back into focus.
  useFocusEffect(
    useCallback(() => {
      const month = shown.current?.month;
      if (month && month !== tashkentMonth()) {
        void refetch();
      }
    }, [refetch]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  const retry = () => void refetch();

  const signedIn = status === 'signedIn';
  const level = signedIn ? (data?.level ?? meLevel.data?.level ?? 1) : 1;
  const xp = signedIn && meLevel.data ? meLevel.data.xpTotal : null;

  let body;
  if (data) {
    body =
      data.nodes.length === 0 ? (
        <EmptyState
          testID="path.empty"
          mascot="worried"
          mascotLabel={t('path.empty.title')}
          title={t('path.empty.title')}
          inline
          action={
            <AppButton
              testID="path.empty.cta"
              label={t('path.empty.cta')}
              onPress={() => navigation.navigate('Explore')}
            />
          }
        />
      ) : (
        <PathTrail
          month={data.month}
          nodes={data.nodes}
          chest={data.chest}
          locale={locale}
          placeType={placeType}
          onOpenPlace={id => navigation.navigate('Place', { id })}
        />
      );
  } else if (query.error) {
    body = (
      <ErrorState testID="path.error" retryTestID="path.retry" error={query.error} onRetry={retry} />
    );
  } else if (!isOnline && status !== 'loading') {
    body = (
      <EmptyState
        testID="path.offline"
        mascot="worried"
        mascotLabel={t('path.offline')}
        title={t('path.offline')}
        inline
      />
    );
  } else {
    body = (
      <View testID="path.skeleton" style={layout.section}>
        <Skeleton height={SKELETON_TRAIL} radius={radii.card} />
      </View>
    );
  }

  return (
    <Screen
      testID="path.screen"
      scroll
      bottomInset={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />
      }
    >
      <PathHeader
        level={level}
        xp={xp}
        month={data?.month ?? tashkentMonth()}
        locale={locale}
        onInfo={() => setSheet('open')}
      >
        {data ? <WeatherStrip days={data.weather.days} /> : null}
      </PathHeader>
      {body}
      {sheet ? (
        <HowBuiltSheet
          closing={sheet === 'closing'}
          onClose={() => setSheet('closing')}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[14] },
});
