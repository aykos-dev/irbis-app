import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useUsersGetBadges } from '../../../shared/api/generated/badges/badges';
import {
  getBuddiesListQueryKey,
  useBuddiesList,
  useBuddiesRequest,
} from '../../../shared/api/generated/buddies/buddies';
import {
  useUsersGetBuddySummary,
  useUsersGetProfile,
  useUsersGetStats,
} from '../../../shared/api/generated/profile/profile';
import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { spacing } from '../../../shared/constants/spacing';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useTheme } from '../../../shared/contexts/theme';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { getLocale, t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { formatDistance, formatElevation } from '../../../shared/utils/units';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function PublicProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
  const { colors } = useTheme();
  const profile = useUsersGetProfile(route.params.username, {
    query: { retry: false },
  });
  const stats = useUsersGetStats(route.params.username, {
    query: { enabled: profile.data?.showStats === true },
  });
  const badges = useUsersGetBadges(route.params.username, {
    query: { enabled: !!profile.data },
  });
  const buddySummary = useUsersGetBuddySummary(route.params.username, {
    query: { enabled: !!profile.data },
  });

  return (
    <Screen testID="public-profile.screen" scroll>
      <Pressable
        testID="public-profile.back"
        accessibilityLabel="Back"
        onPress={navigation.goBack}
      >
        <Icon name="back" color={colors.ink} />
      </Pressable>
      {profile.isLoading ? (
        <>
          <Skeleton height={112} radius={56} width={112} />
          <Skeleton height={44} />
          <Skeleton height={180} />
        </>
      ) : profile.error || !profile.data ? (
        <View testID="public-profile.private" style={styles.center}>
          <AppText variant="h2" style={styles.centered}>
            This profile is private or doesn’t exist.
          </AppText>
          <ErrorState
            testID="public-profile.error"
            retryTestID="public-profile.retry"
            error={profile.error}
            onRetry={() => void profile.refetch()}
          />
        </View>
      ) : (
        <>
          <View style={styles.center}>
            {profile.data.avatarUrl ? (
              <Image
                testID="public-profile.avatar"
                source={{ uri: profile.data.avatarUrl }}
                style={styles.avatar}
                accessibilityLabel="Profile photo"
              />
            ) : (
              <View
                testID="public-profile.avatar"
                style={[styles.avatar, { backgroundColor: colors.navActiveBg }]}
              >
                <AppText variant="h1" style={{ color: colors.navActiveFg }}>
                  {(profile.data.displayName ?? profile.data.username)
                    .slice(0, 2)
                    .toUpperCase()}
                </AppText>
              </View>
            )}
            <AppText
              testID="public-profile.name"
              variant="h2"
              accessibilityRole="header"
            >
              {profile.data.displayName ?? `@${profile.data.username}`}
            </AppText>
            <AppText
              testID="public-profile.username"
              variant="body"
              tone="muted"
            >
              @{profile.data.username}
            </AppText>
            <AppText testID="public-profile.meta" variant="small" tone="muted">
              {profile.data.homeRegion
                ? `${profile.data.homeRegion.replaceAll('_', ' ')} · `
                : ''}
              since{' '}
              {new Date(profile.data.createdAt).toLocaleDateString(
                getLocale(),
                { month: 'short', year: 'numeric' },
              )}
            </AppText>
            {profile.data.bio ? (
              <AppText
                testID="public-profile.bio"
                variant="body"
                style={styles.centered}
              >
                {profile.data.bio}
              </AppText>
            ) : null}
            <AppText variant="chip">Level {profile.data.level}</AppText>
            {buddySummary.data ? (
              <AppText
                testID="public-profile.buddy-count"
                variant="small"
                tone="muted"
              >
                {t('buddies.profile.count', {
                  count: buddySummary.data.buddyCount,
                })}
              </AppText>
            ) : null}
            {route.params.userId ? (
              <AddBuddy
                userId={route.params.userId}
                username={route.params.username}
              />
            ) : null}
          </View>
          <View testID="public-profile.stats" style={styles.section}>
            <AppText variant="h3">Adventure stats</AppText>
            {profile.data.showStats && stats.data ? (
              <AppText variant="body">
                {stats.data.peaks} peaks · {stats.data.lakes} lakes ·{' '}
                {stats.data.caves} caves{`\n`}
                {formatDistance(stats.data.walkedM)} walked ·{' '}
                {formatElevation(stats.data.climbedM)} climbed ·{' '}
                {stats.data.spots} spots
              </AppText>
            ) : (
              <AppText variant="small" tone="muted">
                Stats are private.
              </AppText>
            )}
          </View>
          <View testID="public-profile.badges" style={styles.section}>
            <AppText variant="h3">Badges</AppText>
            {badges.data?.items.length ? (
              <AppText variant="body">
                {badges.data.items
                  .map(item => item.title[getLocale()])
                  .join(' · ')}
              </AppText>
            ) : (
              <AppText variant="small" tone="muted">
                Badges unlock with check-ins.
              </AppText>
            )}
          </View>
          <View testID="public-profile.ratings" style={styles.section}>
            <AppText variant="h3">Buddy ratings</AppText>
            <AppText variant="small" tone="muted">
              No buddy ratings yet.
            </AppText>
          </View>
          <View testID="public-profile.league" style={styles.section}>
            <AppText variant="h3">League</AppText>
            <AppText variant="small" tone="muted">
              Unranked
            </AppText>
          </View>
        </>
      )}
    </Screen>
  );
}

const BUDDY_ERRORS: ReadonlySet<string> = new Set([
  'BUDDY_EXISTS',
  'BUDDY_USER_NOT_FOUND',
  'SECURED_ACCOUNT_REQUIRED',
]);

/** "Add buddy" (buddies AC5), shown when the Buddies screen passed the user id. */
function AddBuddy({ userId, username }: { userId: string; username: string }) {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const requireAccount = useRequireAccount('post');
  const [sent, setSent] = useState(false);
  const signedIn = status === 'signedIn';
  const list = useBuddiesList({ query: { enabled: signedIn } });
  const request = useBuddiesRequest({
    mutation: { meta: { silentError: true } },
  });

  if (user?.username === username) {
    return null;
  }
  const linked = list.data?.buddies.some(link => link.userId === userId);
  const pending =
    sent ||
    list.data?.outgoing.some(link => link.userId === userId) ||
    list.data?.incoming.some(link => link.userId === userId);
  if (linked || pending) {
    return (
      <AppText testID="public-profile.buddy-status" variant="chip" tone="teal700">
        {t(linked ? 'buddies.profile.linked' : 'buddies.profile.requested')}
      </AppText>
    );
  }

  const add = () =>
    requireAccount(() => {
      if (user?.isDemo) {
        toast.show({
          variant: 'error',
          message: t('buddies.errors.SECURED_ACCOUNT_REQUIRED'),
        });
        navigation.navigate('SecureAccount');
        return;
      }
      request.mutateAsync({ data: { userId } }).then(
        link => {
          setSent(true);
          haptics.success();
          toast.show({
            variant: 'success',
            message: t(
              link.status === 'accepted'
                ? 'buddies.toast.accepted'
                : 'buddies.toast.requested',
            ),
          });
          void queryClient.invalidateQueries({
            queryKey: getBuddiesListQueryKey(),
          });
        },
        (error: unknown) => {
          haptics.error();
          const key =
            isApiError(error) && BUDDY_ERRORS.has(error.code)
              ? `buddies.errors.${error.code}`
              : errorMessageKey(error);
          toast.show({ variant: 'error', message: t(key) });
        },
      );
    });

  return (
    <AppButton
      testID="public-profile.add-buddy"
      label={t('buddies.profile.add')}
      loading={request.isPending}
      disabled={!isOnline}
      onPress={add}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing[10] },
  centered: { textAlign: 'center' },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: spacing[8], paddingVertical: spacing[8] },
});
