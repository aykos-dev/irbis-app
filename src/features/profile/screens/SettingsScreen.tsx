import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useMeUpdate } from '../../../shared/api/generated/me/me';
import type {
  Appearance,
  MePreferencesInputDto,
  Units,
} from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { toast } from '../../../shared/components/toastBus';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import {
  createThemedStyles,
  useTheme,
  type AppearancePreference,
} from '../../../shared/contexts/theme';
import {
  getLocale,
  languageNames,
  setLocale,
  type Locale,
} from '../../../shared/i18n';
import { setStoredUnits } from '../../../shared/utils/units';
import { SettingToggle } from '../components/SettingToggle';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, setAppearance } = useTheme();
  const styles = useStyles();
  const { user, setUser, signOut } = useAuth();
  const update = useMeUpdate();
  if (!user)
    return (
      <Screen testID="settings.loading">
        <AppText variant="body">Settings are unavailable.</AppText>
      </Screen>
    );
  const prefs = user.preferences;

  const save = async (
    preferences: MePreferencesInputDto,
    optimistic?: () => (() => void) | void,
  ) => {
    const before = user;
    const rollback = optimistic?.();
    try {
      const next = await update.mutateAsync({ data: { preferences } });
      setUser(next);
    } catch {
      rollback?.();
      setUser(before);
      toast.show({
        variant: 'error',
        message: 'Could not save this setting. Try again.',
      });
    }
  };

  const notification = (
    key:
      'streakReminders' | 'dailyGame' | 'groupsMessages' | 'social' | 'offers',
    value: boolean,
  ) => void save({ notifications: { [key]: value } });
  const privacy = (key: 'publicProfile' | 'findBuddies', value: boolean) =>
    void save({ privacy: { [key]: value } });

  const chooseLocale = async (locale: Locale) => {
    setLocale(locale);
    try {
      setUser(await update.mutateAsync({ data: { locale } }));
    } catch {
      toast.show({ variant: 'error', message: 'Could not save language.' });
    }
  };
  const chooseUnits = (units: Units) =>
    void save({ units }, () => {
      const previous = prefs.units;
      setStoredUnits(units);
      return () => setStoredUnits(previous);
    });
  const chooseAppearance = (appearance: Appearance) =>
    void save({ appearance }, () => {
      const previous = prefs.appearance;
      setAppearance(appearance as AppearancePreference);
      return () => setAppearance(previous as AppearancePreference);
    });

  return (
    <Screen testID="settings.screen" scroll>
      <View style={layout.header}>
        <Pressable
          testID="settings.back"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1" accessibilityRole="header">
          Settings
        </AppText>
      </View>
      <Section title="Irbis Plus">
        <ListCard>
          <ListRow
            first
            testID="settings.plus"
            label="Irbis Plus"
            value="Preview"
            icon={<Icon name="star" color={colors.goldEdge} />}
          />
        </ListCard>
      </Section>
      <Section title="Account">
        <ListCard>
          <ListRow
            first
            testID="settings.edit-profile"
            label="Edit profile"
            icon={<Icon name="person" color={colors.muted} />}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <ListRow
            testID="settings.recovery-phone"
            label="Recovery phone"
            icon={<Icon name="phone" color={colors.muted} />}
            value={
              user.hasRecoveryPhone
                ? 'Verified'
                : user.recoveryPhonePending
                  ? 'Verify'
                  : 'Add'
            }
            onPress={() => navigation.navigate('RecoveryPhone')}
          />
        </ListCard>
        <ChoiceRow
          prefix="settings.language"
          value={getLocale()}
          choices={(['uz', 'ru', 'en'] as Locale[]).map(value => ({
            value,
            label: languageNames[value],
          }))}
          onPick={chooseLocale}
        />
        <ChoiceRow
          prefix="settings.units"
          value={prefs.units}
          choices={[
            { value: 'metric', label: 'km · m' },
            { value: 'imperial', label: 'mi · ft' },
          ]}
          onPick={chooseUnits}
        />
        <ChoiceRow
          prefix="settings.appearance"
          value={prefs.appearance}
          choices={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ]}
          onPick={chooseAppearance}
        />
      </Section>
      <Section title="Notifications">
        <ListCard>
          <ListRow
            first
            testID="settings.notifications-inbox"
            label="Notifications"
            icon={<Icon name="info" color={colors.muted} />}
            onPress={() => navigation.navigate('Notifs')}
          />
          <ListRow
            testID="settings.trip-safety"
            label="Trip & safety"
            value="Always on"
            icon={<Icon name="shield" color={colors.pine} />}
          />
        </ListCard>
        <SettingToggle
          testID="settings.notify-streak"
          label="Streak reminders"
          value={prefs.notifications.streakReminders}
          onChange={value => notification('streakReminders', value)}
        />
        <SettingToggle
          testID="settings.notify-daily"
          label={`Bu qayer? daily at ${prefs.notifications.dailyGameTime}`}
          value={prefs.notifications.dailyGame}
          onChange={value => notification('dailyGame', value)}
        />
        <ChoiceRow
          prefix="settings.daily-time"
          value={prefs.notifications.dailyGameTime.slice(0, 2)}
          choices={['18', '19', '20', '21'].map(value => ({
            value,
            label: `${value}:00`,
          }))}
          onPick={value =>
            void save({ notifications: { dailyGameTime: `${value}:00` } })
          }
        />
        <SettingToggle
          testID="settings.notify-groups"
          label="Groups & messages"
          value={prefs.notifications.groupsMessages}
          onChange={value => notification('groupsMessages', value)}
        />
        <SettingToggle
          testID="settings.notify-social"
          label="Likes, comments, Top Shots"
          value={prefs.notifications.social}
          onChange={value => notification('social', value)}
        />
        <SettingToggle
          testID="settings.notify-offers"
          label="Tours & offers"
          value={prefs.notifications.offers}
          onChange={value => notification('offers', value)}
        />
      </Section>
      <Section title="Privacy">
        <SettingToggle
          testID="settings.privacy-public"
          label="Public profile"
          value={prefs.privacy.publicProfile}
          onChange={value => privacy('publicProfile', value)}
        />
        <SettingToggle
          testID="settings.privacy-find-buddies"
          label="Show me in Find buddies"
          value={prefs.privacy.findBuddies}
          onChange={value => privacy('findBuddies', value)}
        />
        <ListCard>
          <ListRow
            first
            testID="settings.share-location"
            label="Share location"
            icon={<Icon name="explore" color={colors.muted} />}
            value="Trips only"
          />
          <ListRow
            testID="settings.blocked"
            label="Blocked people"
            icon={<Icon name="person" color={colors.muted} />}
            value="0 · Coming with Community"
          />
        </ListCard>
      </Section>
      <Section title="More">
        <ListCard>
          <ListRow
            first
            testID="settings.safety"
            label="Safety center & offline maps"
            icon={<Icon name="shield" color={colors.muted} />}
            onPress={() => navigation.navigate('Safety')}
          />
          <ListRow
            testID="settings.guidelines"
            label="Community guidelines"
            icon={<Icon name="info" color={colors.muted} />}
            value="Coming soon"
          />
          <ListRow
            testID="settings.help"
            label="Help & feedback"
            icon={<Icon name="info" color={colors.muted} />}
            onPress={() => navigation.navigate('Help')}
          />
        </ListCard>
      </Section>
      <Pressable
        testID="settings.logout"
        accessibilityLabel="Log out"
        onPress={() => void signOut()}
        style={[layout.action, styles.action]}
      >
        <AppText variant="body" style={{ color: colors.red700 }}>
          Log out
        </AppText>
      </Pressable>
      <AppText
        testID="settings.version"
        variant="caption"
        tone="muted"
        style={layout.centered}
      >
        Irbis 1.0
      </AppText>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={layout.section}>
      <AppText variant="chip" tone="muted">
        {title}
      </AppText>
      {children}
    </View>
  );
}
function ChoiceRow<T extends string>({
  prefix,
  value,
  choices,
  onPick,
}: {
  prefix: string;
  value: T;
  choices: { value: T; label: string }[];
  onPick: (value: T) => void | Promise<void>;
}) {
  const styles = useStyles();
  return (
    <View style={layout.choices}>
      {choices.map(choice => (
        <Pressable
          key={choice.value}
          testID={`${prefix}-${choice.value}`}
          accessibilityLabel={choice.label}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === choice.value }}
          onPress={() => void onPick(choice.value)}
          style={[
            layout.choice,
            value === choice.value ? styles.selected : styles.choice,
          ]}
        >
          <AppText variant="small">{choice.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}
const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  section: { gap: spacing[8] },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  choice: {
    minHeight: 44,
    paddingHorizontal: spacing[14],
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  action: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.tile,
  },
  centered: { textAlign: 'center' },
});
const useStyles = createThemedStyles(c => ({
  choice: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 },
  selected: {
    backgroundColor: c.navActiveBg,
    borderColor: c.teal,
    borderWidth: 1,
  },
  action: { backgroundColor: c.card },
}));
