import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useReducedMotion,
} from 'react-native-reanimated';

import type { RootStackParamList } from '../../../app/navigation/types';
import {
  getLeaguesCurrentQueryKey,
  useLeaguesCurrent,
  useMeSeenLeagueResult,
} from '../../../shared/api/generated/leagues/leagues';
import type {
  LeagueResultDto,
  LeagueStandingDto,
  LeagueTier,
} from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { formatElevation } from '../../../shared/utils/units';
import { leagueArt, leagueDemotionArt } from '../leagueArt';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const tiers: LeagueTier[] = [
  'scout',
  'tracker',
  'ranger',
  'vanguard',
  'legend',
];
const RESULT_SKIP_DELAY_MS = 1000;

function countdown(end: string): string {
  const remaining = Math.max(0, Date.parse(end) - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  return t('leagues.countdown', { days, hours });
}

export function LeaguesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const query = useLeaguesCurrent({ query: { staleTime: 30_000 } });
  const seen = useMeSeenLeagueResult();
  const finishResult = async () => {
    await seen.mutateAsync();
    await queryClient.invalidateQueries({
      queryKey: getLeaguesCurrentQueryKey(),
    });
    haptics.success();
  };
  return (
    <Screen
      testID="league.screen"
      scroll
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.teal}
          colors={[colors.teal]}
        />
      }
    >
      <View style={layout.header}>
        <Pressable
          testID="league.back"
          accessibilityRole="button"
          accessibilityLabel={t('leagues.back')}
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1" accessibilityRole="header">
          {t('leagues.title')}
        </AppText>
      </View>
      {query.isLoading ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState
          testID="league.error"
          retryTestID="league.retry"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.pendingResult ? (
            <ResultCard
              result={query.data.pendingResult}
              busy={seen.isPending}
              onDone={() => void finishResult()}
            />
          ) : null}
          <View style={layout.progression} testID="league.progression">
            {tiers.map(tier => (
              <Image
                key={tier}
                source={leagueArt[tier]}
                style={[
                  layout.smallCrest,
                  tier !== query.data?.tier && layout.dim,
                ]}
                accessibilityLabel={t(`leagues.tiers.${tier}.name`)}
              />
            ))}
          </View>
          <View style={layout.hero}>
            {query.data.tier ? (
              <Image
                testID="league.tier"
                source={leagueArt[query.data.tier]}
                style={layout.crest}
                accessibilityLabel={t(`leagues.tiers.${query.data.tier}.name`)}
              />
            ) : null}
            <AppText variant="h1" style={layout.center}>
              {query.data.tier
                ? t('leagues.leagueName', {
                    tier: t(`leagues.tiers.${query.data.tier}.name`),
                  })
                : t('leagues.unranked.title')}
            </AppText>
            <AppText
              testID="league.season"
              variant="body"
              tone="muted"
              style={layout.center}
            >
              {query.data.season.name}
            </AppText>
            <AppText
              testID="league.countdown"
              variant="small"
              tone="muted"
              style={layout.center}
            >
              {countdown(
                query.data.season.status === 'settling'
                  ? query.data.season.settlesAt
                  : query.data.season.endsAt,
              )}
            </AppText>
            {query.data.ranked ? (
              <AppText testID="league.elevation" variant="stat">
                {formatElevation(query.data.elevationM)}
              </AppText>
            ) : (
              <AppText
                testID="league.join-note"
                variant="body"
                tone="muted"
                style={layout.center}
              >
                {t('leagues.unranked.body')}
              </AppText>
            )}
          </View>
          {query.data.ranked && query.data.movement ? (
            <View style={[styles.board, layout.board]}>
              <Zone
                testID={
                  query.data.movement.champion
                    ? 'league.champion-zone'
                    : 'league.promotion-zone'
                }
                label={
                  query.data.movement.champion
                    ? t('leagues.zones.champion')
                    : t('leagues.zones.promote', {
                        count: query.data.movement.promote,
                      })
                }
                success
              />
              {query.data.standings.map(row => (
                <Standing
                  key={row.memberId}
                  row={row}
                  onOpen={() =>
                    row.username &&
                    navigation.navigate('PublicProfile', {
                      username: row.username,
                    })
                  }
                />
              ))}
              {query.data.movement.demote > 0 ? (
                <Zone
                  testID="league.demotion-zone"
                  label={t('leagues.zones.demote', {
                    count: query.data.movement.demote,
                  })}
                />
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Loading() {
  return (
    <View testID="league.loading" style={layout.loading}>
      <Skeleton
        height={sizes.leagueCrest}
        width={sizes.leagueCrest}
        radius={radii.pill}
      />
      <Skeleton height={sizes.touchTarget} />
      <Skeleton height={sizes.mascotCard} />
      <Skeleton height={sizes.mascotCard} />
    </View>
  );
}

function Zone({
  testID,
  label,
  success = false,
}: {
  testID: string;
  label: string;
  success?: boolean;
}) {
  const styles = useStyles();
  return (
    <View
      testID={testID}
      style={[styles.zone, success ? styles.successZone : styles.dangerZone]}
    >
      <AppText variant="caption" tone={success ? 'teal700' : 'red700'}>
        {label}
      </AppText>
    </View>
  );
}

function Standing({
  row,
  onOpen,
}: {
  row: LeagueStandingDto;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const content = (
    <>
      <AppText variant="h3" style={layout.rank}>
        {row.rank}
      </AppText>
      {row.avatarUrl ? (
        <Image
          source={{ uri: row.avatarUrl }}
          style={layout.avatar}
          accessibilityLabel={row.displayName}
        />
      ) : (
        <CompanionArt
          level={row.level}
          size={sizes.leagueCrestSmall}
          accessibilityLabel={row.displayName}
        />
      )}
      <AppText variant="body" style={layout.name}>
        {row.displayName}
        {row.isMe ? ` ${t('leagues.you')}` : ''}
      </AppText>
      <AppText variant="chip">{formatElevation(row.elevationM)}</AppText>
    </>
  );
  return row.username && !row.isMe ? (
    <Pressable
      testID={`league.row.${row.memberId}`}
      accessibilityRole="button"
      accessibilityLabel={row.displayName}
      onPress={onOpen}
      style={[styles.row, row.isMe && styles.me]}
    >
      {content}
    </Pressable>
  ) : (
    <View
      testID={`league.row.${row.memberId}`}
      accessible
      accessibilityLabel={row.displayName}
      style={[styles.row, row.isMe && styles.me]}
    >
      {content}
    </View>
  );
}

function ResultCard({
  result,
  busy,
  onDone,
}: {
  result: LeagueResultDto;
  busy: boolean;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const [canContinue, setCanContinue] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setCanContinue(true), RESULT_SKIP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [reduced]);
  const demoted = result.outcome === 'demoted';
  return (
    <Animated.View
      testID="league.result"
      entering={reduced ? undefined : FadeIn.duration(300)}
      exiting={reduced ? undefined : FadeOut.duration(200)}
      style={layout.result}
    >
      <Image
        source={demoted ? leagueDemotionArt : leagueArt[result.toTier]}
        style={demoted ? layout.resultMascot : layout.crest}
        accessibilityLabel={t(`leagues.result.${result.outcome}.title`)}
      />
      <AppText variant="h2" style={layout.center}>
        {t(`leagues.result.${result.outcome}.title`)}
      </AppText>
      <AppText variant="body" tone="muted" style={layout.center}>
        {t('leagues.result.body', {
          season: result.seasonName,
          rank: result.rank,
          elevation: formatElevation(result.elevationM),
        })}
      </AppText>
      <AppButton
        testID="league.result.done"
        label={t('leagues.result.done')}
        disabled={!canContinue}
        loading={busy}
        onPress={onDone}
      />
    </Animated.View>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  progression: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[8],
  },
  smallCrest: { width: sizes.leagueCrestSmall, height: sizes.leagueCrestSmall },
  dim: { opacity: 0.35 },
  hero: { alignItems: 'center', gap: spacing[8] },
  crest: { width: sizes.leagueCrest, height: sizes.leagueCrest },
  center: { textAlign: 'center' },
  board: { overflow: 'hidden' },
  rank: { width: spacing[28], textAlign: 'center' },
  avatar: {
    width: sizes.leagueCrestSmall,
    height: sizes.leagueCrestSmall,
    borderRadius: radii.pill,
  },
  name: { flex: 1 },
  loading: { alignItems: 'center', gap: spacing[12] },
  result: { alignItems: 'center', gap: spacing[12] },
  resultMascot: {
    width: sizes.leagueResultMascot,
    height: sizes.leagueResultMascot,
  },
});

const useStyles = createThemedStyles(c => ({
  board: {
    backgroundColor: c.card,
    borderColor: c.line,
    borderWidth: borders.card,
    borderRadius: radii.card,
  },
  row: {
    minHeight: spacing[56],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    paddingHorizontal: spacing[12],
    borderBottomColor: c.line,
    borderBottomWidth: 1,
  },
  me: { backgroundColor: c.navActiveBg },
  zone: { alignItems: 'center', padding: spacing[8] },
  successZone: { backgroundColor: c.soft },
  dangerZone: { backgroundColor: c.soft },
}));
