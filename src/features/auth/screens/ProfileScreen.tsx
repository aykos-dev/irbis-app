import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState, type ReactNode } from 'react';
import { Image, Share, StyleSheet, View } from 'react-native';

import type {
  MainTabScreenProps,
  RootStackParamList,
} from '../../../app/navigation/types';
import { useMeLevelGet } from '../../../shared/api/generated';
import { useBadgesList } from '../../../shared/api/generated/badges/badges';
import { useMeStats } from '../../../shared/api/generated/me/me';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import {
  levelMeta,
  MIN_LEVEL,
} from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Sheet } from '../../../shared/components/Sheet';
import { Skeleton } from '../../../shared/components/Skeleton';
import { appConfig } from '../../../shared/constants/config';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { getLocale, languageNames, t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { LanguageSheet } from '../../../shared/components/LanguageSheet';
import { formatDistance, formatElevation } from '../../../shared/utils/units';

const COMPANION_RING = 132;
const COMPANION_ART = 108;
const ROW_ICON = 22;

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** Profile tab: the guest profile (A6) until signed in, then the account (AC2, AC6). */
type Props = MainTabScreenProps<'Profile'> & {
  /** The account's streak row from the app layer (streaks AC7). */
  streaksCard?: ReactNode;
};

export function ProfileScreen({ streaksCard }: Props) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <Screen testID="profile.loading" bottomInset={false}>
        <Skeleton
          height={COMPANION_RING}
          radius={COMPANION_RING}
          width={COMPANION_RING}
        />
        <Skeleton height={spacing[44]} />
        <Skeleton height={spacing[56]} />
      </Screen>
    );
  }
  return status === 'signedIn' ? (
    <AccountProfile streaksCard={streaksCard} />
  ) : (
    <GuestProfile />
  );
}

/**
 * The user's companion in their level's colour (levels AC8); opens the Level screen. Guests, and a
 * level that has not loaded yet, show level 1 — never a guessed level.
 */
function CompanionBadge({ level }: { level: number }) {
  const navigation = useNavigation<RootNav>();
  const meta = levelMeta(level);
  const name = t(meta.nameKey);
  return (
    <Pressable
      testID="profile.companion-badge"
      accessibilityRole="button"
      accessibilityLabel={`${t('levels.pill', { n: meta.level })}, ${name}`}
      onPress={() => {
        haptics.tap();
        navigation.navigate('Level');
      }}
      style={[
        styles.ring,
        { backgroundColor: meta.tint, borderColor: meta.color },
      ]}
    >
      <CompanionArt level={meta.level} size={COMPANION_ART} />
    </Pressable>
  );
}

function AccountCompanionBadge() {
  const { data } = useMeLevelGet();
  return <CompanionBadge level={data?.level ?? MIN_LEVEL} />;
}

function useProfileRows() {
  useLocale();
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageClosing, setLanguageClosing] = useState(false);

  const languageRow = (
    <ListRow
      first
      testID="profile.language"
      label={t('auth.profile.language')}
      value={languageNames[getLocale()]}
      icon={<Icon name="globe" color={colors.muted} size={ROW_ICON} />}
      onPress={() => {
        setLanguageClosing(false);
        setLanguageOpen(true);
      }}
    />
  );
  const safetyRow = (
    <ListRow
      testID="profile.safety"
      label={t('auth.profile.safety')}
      value={t('auth.profile.safetyNote')}
      icon={<Icon name="shield" color={colors.red700} size={ROW_ICON} />}
      onPress={() => navigation.navigate('Safety')}
    />
  );
  const debugRow = appConfig.isQaEnabled ? (
    <ListRow
      testID="profile.debug"
      label={t('auth.profile.debug')}
      icon={<Icon name="info" color={colors.muted} size={ROW_ICON} />}
      trailing={<Icon name="chevron" color={colors.stone} size={spacing[18]} />}
      onPress={() => navigation.navigate('Debug')}
    />
  ) : null;
  const sheet = languageOpen ? (
    <LanguageSheet
      closing={languageClosing}
      onPick={() => setLanguageClosing(true)}
      onDismiss={() => {
        setLanguageOpen(false);
        setLanguageClosing(false);
      }}
    />
  ) : null;

  return { navigation, languageRow, safetyRow, debugRow, sheet };
}

/** A6 — "You're exploring as a guest". */
function GuestProfile() {
  const { navigation, languageRow, safetyRow, debugRow, sheet } =
    useProfileRows();

  return (
    <Screen testID="profile.guest" scroll bottomInset={false}>
      <View style={styles.hero}>
        <CompanionBadge level={MIN_LEVEL} />
        <AppText
          variant="h2"
          accessibilityRole="header"
          style={styles.centered}
        >
          {t('auth.profile.guestTitle')}
        </AppText>
        <AppText variant="body" tone="muted" style={styles.centered}>
          {t('auth.profile.guestBody')}
        </AppText>
      </View>
      <View style={styles.actions}>
        <AppButton
          testID="profile.guest-signup"
          label={t('auth.profile.createAccount')}
          onPress={() => navigation.navigate('Auth', { screen: 'SignUp' })}
        />
        <AppButton
          testID="profile.guest-login"
          label={t('auth.profile.logIn')}
          variant="white"
          onPress={() => navigation.navigate('Auth', { screen: 'LogIn' })}
        />
      </View>
      <ListCard>
        {languageRow}
        {safetyRow}
        {debugRow}
      </ListCard>
      {sheet}
    </Screen>
  );
}

/** A demo account (check-in AC8): "Secure your account" card, opens SecureAccount. */
function SecureCard({ onPress }: { onPress: () => void }) {
  const themed = useCardStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID="profile.secure-card"
      accessibilityRole="button"
      accessibilityLabel={t('auth.secure.card')}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={themed.card}
    >
      <Icon name="shield" color={colors.navActiveFg} size={ROW_ICON} />
      <AppText variant="small" style={themed.text}>
        {t('auth.secure.card')}
      </AppText>
      <Icon name="chevron" color={colors.navActiveFg} size={spacing[18]} />
    </Pressable>
  );
}

/** Signing out of a demo account loses it (ADR-006): ask first. */
function DemoSignOutSheet({
  username,
  closing,
  onSignOut,
  onSecure,
  onDismiss,
}: {
  username: string;
  closing: boolean;
  onSignOut: () => void;
  onSecure: () => void;
  onDismiss: () => void;
}) {
  return (
    <Sheet
      testID="profile.demo-sign-out"
      accessibilityLabel={t('auth.profile.demoSignOutTitle')}
      closing={closing}
      onDismiss={onDismiss}
    >
      <AppText variant="h2" accessibilityRole="header">
        {t('auth.profile.demoSignOutTitle')}
      </AppText>
      <AppText variant="body" tone="muted">
        {t('auth.profile.demoSignOutBody', { username })}
      </AppText>
      <AppButton
        testID="profile.demo-sign-out-secure"
        label={t('auth.profile.secureAction')}
        onPress={onSecure}
      />
      <AppButton
        testID="profile.demo-sign-out-confirm"
        label={t('auth.profile.signOut')}
        variant="white"
        onPress={onSignOut}
      />
    </Sheet>
  );
}

/** Signed-in profile: username, recovery phone, sign out (AC6); a demo account adds Secure (check-in AC8). */
function AccountProfile({ streaksCard }: { streaksCard?: ReactNode }) {
  const { navigation, languageRow, safetyRow, debugRow, sheet } =
    useProfileRows();
  const { colors } = useTheme();
  const { user, userError, reloadUser, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClosing, setConfirmClosing] = useState(false);
  const statsQuery = useMeStats();
  const badgesQuery = useBadgesList();

  if (!user) {
    return (
      <Screen testID="profile.account-loading" scroll bottomInset={false}>
        {userError ? (
          <ErrorState
            testID="profile.error"
            retryTestID="profile.retry"
            error={userError}
            onRetry={reloadUser}
          />
        ) : (
          <>
            <Skeleton
              height={COMPANION_RING}
              radius={COMPANION_RING}
              width={COMPANION_RING}
            />
            <Skeleton height={spacing[44]} />
            <Skeleton height={spacing[56]} />
          </>
        )}
      </Screen>
    );
  }

  const phoneValue = user.hasRecoveryPhone
    ? t('auth.profile.phoneVerified')
    : user.recoveryPhonePending
      ? t('auth.profile.phonePending')
      : t('auth.profile.phoneAdd');

  const name = user.displayName ?? `@${user.username}`;
  const initials = (user.displayName ?? user.username)
    .slice(0, 2)
    .toUpperCase();
  const since = new Date(user.createdAt).toLocaleDateString(getLocale(), {
    month: 'short',
    year: 'numeric',
  });
  const home =
    user.preferences?.showHomeRegion && user.homeRegion
      ? ` · ${user.homeRegion.replaceAll('_', ' ')}`
      : '';
  const profileStats = statsQuery.data ?? {
    peaks: 0,
    lakes: 0,
    caves: 0,
    walkedM: 0,
    climbedM: 0,
    spots: 0,
  };

  const onSignOut = async () => {
    setConfirmClosing(true);
    haptics.warning();
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen testID="profile.account" scroll bottomInset={false}>
      <View style={styles.hero}>
        <View style={styles.identityActions}>
          <Pressable
            testID="profile.settings"
            accessibilityLabel="Settings"
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="info" color={colors.ink} />
          </Pressable>
          <Pressable
            testID="profile.share"
            accessibilityLabel="Share profile"
            onPress={() => {
              void Share.share({
                message: `${name}\n@${user.username}\nirbis://profile/${user.username}`,
              });
            }}
          >
            <Icon name="share" color={colors.ink} />
          </Pressable>
        </View>
        {user.avatarUrl ? (
          <Image
            testID="profile.avatar"
            source={{ uri: user.avatarUrl }}
            style={styles.avatar}
            accessibilityLabel={`${name} profile photo`}
          />
        ) : (
          <View
            testID="profile.avatar"
            style={[styles.avatar, { backgroundColor: colors.navActiveBg }]}
            accessibilityLabel={`${name} initials`}
          >
            <AppText variant="h1" style={{ color: colors.navActiveFg }}>
              {initials}
            </AppText>
          </View>
        )}
        <AppText
          variant="h2"
          testID="profile.name"
          accessibilityRole="header"
          style={styles.centered}
        >
          {name}
        </AppText>
        <AppText
          variant="body"
          testID="profile.username"
          tone="muted"
          style={styles.centered}
        >
          {user.username}
        </AppText>
        <AppText
          variant="small"
          testID="profile.meta"
          tone="muted"
          style={styles.centered}
        >
          @{user.username}
          {home} · since {since}
        </AppText>
        {user.bio ? (
          <AppText variant="body" style={styles.centered}>
            {user.bio}
          </AppText>
        ) : null}
        <View testID="profile.level" style={styles.levelRow}>
          <AccountCompanionBadge />
          <AppText variant="chip">
            Level {user.level} · {t(levelMeta(user.level).nameKey)}
          </AppText>
        </View>
      </View>
      {user.isDemo ? (
        <SecureCard onPress={() => navigation.navigate('SecureAccount')} />
      ) : null}
      {streaksCard}
      <View testID="profile.stats" style={styles.section}>
        <AppText variant="h3">Adventure stats</AppText>
        <View style={styles.statsGrid}>
          <Stat
            testID="profile.stats-peaks"
            value={String(profileStats.peaks)}
            label="Peaks"
          />
          <Stat
            testID="profile.stats-lakes"
            value={String(profileStats.lakes)}
            label="Lakes"
          />
          <Stat
            testID="profile.stats-caves"
            value={String(profileStats.caves)}
            label="Caves"
          />
          <Stat
            testID="profile.stats-walked"
            value={formatDistance(profileStats.walkedM)}
            label="Walked"
          />
          <Stat
            testID="profile.stats-climbed"
            value={formatElevation(profileStats.climbedM)}
            label="Climbed"
          />
          <Stat
            testID="profile.stats-spots"
            value={String(profileStats.spots)}
            label="Spots"
          />
        </View>
        {Object.values(profileStats).every(value => value === 0) ? (
          <AppText variant="small" tone="muted">
            Stats start with your first check-in.
          </AppText>
        ) : null}
      </View>
      <Pressable
        testID="profile.badges"
        accessibilityLabel="Open badges"
        onPress={() => navigation.navigate('Badges')}
        style={styles.section}
      >
        <AppText variant="h3">Badges</AppText>
        <View style={styles.badgeRow}>
          {(
            badgesQuery.data?.items.filter(item => item.showcase).slice(0, 4) ??
            []
          ).map(item => (
            <View
              key={item.key}
              style={[styles.badgeDot, { backgroundColor: colors.navActiveBg }]}
            >
              <Icon name="star" color={colors.navActiveFg} />
            </View>
          ))}
          {Array.from(
            {
              length: Math.max(0, 4 - (badgesQuery.data?.showcase.length ?? 0)),
            },
            (_, index) => (
              <View
                key={index}
                style={[styles.badgeDot, { backgroundColor: colors.soft }]}
              >
                <Icon name="lock" color={colors.muted} />
              </View>
            ),
          )}
        </View>
        <AppText variant="small" tone="muted">
          {badgesQuery.data?.collected
            ? `${badgesQuery.data.collected} collected`
            : 'Badges unlock with check-ins.'}
        </AppText>
      </Pressable>
      <View testID="profile.ratings" style={styles.section}>
        <AppText variant="h3">Buddy ratings</AppText>
        <AppText variant="small" tone="muted">
          No buddy ratings yet.
        </AppText>
      </View>
      <View testID="profile.league" style={styles.section}>
        <AppText variant="h3">League</AppText>
        <AppText variant="small" tone="muted">
          Unranked
        </AppText>
      </View>
      <ListCard>
        {languageRow}
        <ListRow
          testID="profile.recovery-phone"
          label={t('auth.profile.recoveryPhone')}
          value={phoneValue}
          icon={<Icon name="phone" color={colors.muted} size={ROW_ICON} />}
          trailing={
            user.hasRecoveryPhone ? (
              <Icon
                name="checkCircle"
                color={colors.pine}
                accent={colors.white}
                size={ROW_ICON}
              />
            ) : (
              <Icon name="chevron" color={colors.stone} size={spacing[18]} />
            )
          }
          onPress={
            user.hasRecoveryPhone
              ? undefined
              : () => navigation.navigate('RecoveryPhone')
          }
        />
        {safetyRow}
        <ListRow
          testID="profile.marketplace"
          label="Marketplace"
          value="Preview"
          icon={<Icon name="star" color={colors.muted} size={ROW_ICON} />}
        />
        {debugRow}
      </ListCard>
      <AppButton
        testID="profile.sign-out"
        label={t('auth.profile.signOut')}
        variant="white"
        loading={signingOut}
        onPress={() => {
          if (user.isDemo) {
            setConfirmClosing(false);
            setConfirmOpen(true);
          } else {
            void onSignOut();
          }
        }}
      />
      {sheet}
      {confirmOpen ? (
        <DemoSignOutSheet
          username={user.username}
          closing={confirmClosing}
          onSignOut={() => void onSignOut()}
          onSecure={() => {
            setConfirmClosing(true);
            navigation.navigate('SecureAccount');
          }}
          onDismiss={() => {
            setConfirmOpen(false);
            setConfirmClosing(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Stat({
  testID,
  value,
  label,
}: {
  testID: string;
  value: string;
  label: string;
}) {
  return (
    <View testID={testID} style={styles.stat}>
      <AppText variant="h3">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing[10], paddingTop: spacing[18] },
  ring: {
    width: COMPANION_RING,
    height: COMPANION_RING,
    borderRadius: COMPANION_RING / 2,
    borderWidth: borders.ring,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  actions: { gap: spacing[12] },
  identityActions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelRow: { alignItems: 'center', gap: spacing[8] },
  section: {
    backgroundColor: 'transparent',
    gap: spacing[10],
    paddingVertical: spacing[8],
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  stat: { width: '29%', gap: spacing[4] },
  badgeRow: { flexDirection: 'row', gap: spacing[10] },
  badgeDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useCardStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.navActiveBorder,
    backgroundColor: c.navActiveBg,
  },
  text: { flex: 1, color: c.navActiveFg },
}));
