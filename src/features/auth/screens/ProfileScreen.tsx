import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MainTabScreenProps, RootStackParamList } from '../../../app/navigation/types';
import { useMeLevelGet } from '../../../shared/api/generated';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta, MIN_LEVEL } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { appConfig } from '../../../shared/constants/config';
import { borders, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { getLocale, languageNames, t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { LanguageSheet } from '../../../shared/components/LanguageSheet';

const COMPANION_RING = 132;
const COMPANION_ART = 108;
const ROW_ICON = 22;

type RootNav = NativeStackNavigationProp<RootStackParamList>;

/** Profile tab: the guest profile (A6) until signed in, then the account (AC2, AC6). */
export function ProfileScreen(_props: MainTabScreenProps<'Profile'>) {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <Screen testID="profile.loading" bottomInset={false}>
        <Skeleton height={COMPANION_RING} radius={COMPANION_RING} width={COMPANION_RING} />
        <Skeleton height={spacing[44]} />
        <Skeleton height={spacing[56]} />
      </Screen>
    );
  }
  return status === 'signedIn' ? <AccountProfile /> : <GuestProfile />;
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
      style={[styles.ring, { backgroundColor: meta.tint, borderColor: meta.color }]}
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
  const { navigation, languageRow, safetyRow, debugRow, sheet } = useProfileRows();

  return (
    <Screen testID="profile.guest" scroll bottomInset={false}>
      <View style={styles.hero}>
        <CompanionBadge level={MIN_LEVEL} />
        <AppText variant="h2" accessibilityRole="header" style={styles.centered}>
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

/** Signed-in profile: username, recovery phone, sign out (AC6). */
function AccountProfile() {
  const { navigation, languageRow, safetyRow, debugRow, sheet } = useProfileRows();
  const { colors } = useTheme();
  const { user, userError, reloadUser, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

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
            <Skeleton height={COMPANION_RING} radius={COMPANION_RING} width={COMPANION_RING} />
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

  const onSignOut = async () => {
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
        <AccountCompanionBadge />
        <AppText variant="h2" testID="profile.username" accessibilityRole="header" style={styles.centered}>
          {user.username}
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
              <Icon name="checkCircle" color={colors.pine} accent={colors.white} size={ROW_ICON} />
            ) : (
              <Icon name="chevron" color={colors.stone} size={spacing[18]} />
            )
          }
          onPress={user.hasRecoveryPhone ? undefined : () => navigation.navigate('RecoveryPhone')}
        />
        {safetyRow}
        {debugRow}
      </ListCard>
      <AppButton
        testID="profile.sign-out"
        label={t('auth.profile.signOut')}
        variant="white"
        loading={signingOut}
        onPress={onSignOut}
      />
      {sheet}
    </Screen>
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
});
