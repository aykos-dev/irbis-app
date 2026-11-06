import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { useBuddiesList } from '../../../shared/api/generated/buddies/buddies';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { FindTab } from '../components/FindTab';
import { MineTab } from '../components/MineTab';

type Tab = 'find' | 'mine';

/** Buddies (buddies AC1–AC6): Find · Mine, the Mine badge counts incoming requests. */
export function BuddiesScreen({ navigation, route }: RootStackScreenProps<'Buddies'>) {
  useLocale();
  const { colors } = useTheme();
  const styles = useStyles();
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const requireAccount = useRequireAccount('post');
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'find');
  const list = useBuddiesList({ query: { enabled: signedIn } });
  const incoming = list.data?.incoming.length ?? 0;

  const title = (
    <View style={layout.header}>
      <Pressable
        testID="buddies.back"
        accessibilityRole="button"
        accessibilityLabel={t('buddies.back')}
        onPress={navigation.goBack}
        style={styles.back}
      >
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <AppText variant="h1" accessibilityRole="header" style={layout.title}>
        {t(tab === 'find' ? 'buddies.find.title' : 'buddies.title')}
      </AppText>
    </View>
  );

  if (!signedIn) {
    return (
      <Screen testID="buddies.screen" showOfflineBanner>
        {title}
        <EmptyState
          testID="buddies.guest"
          mascot="default"
          mascotLabel={t('buddies.guest.title')}
          title={t('buddies.guest.title')}
          body={t('buddies.guest.body')}
          action={
            <AppButton testID="buddies.guest-login" label={t('buddies.guest.action')} onPress={() => requireAccount(() => undefined)} />
          }
        />
      </Screen>
    );
  }

  const header = (
    <View style={layout.top}>
      {title}
      <View style={[layout.track, styles.track]} accessibilityRole="tablist">
        {(['find', 'mine'] as const).map(option => {
          const selected = option === tab;
          const label = t(`buddies.segments.${option}`);
          const badge = option === 'mine' && incoming > 0;
          return (
            <Pressable
              key={option}
              testID={`buddies.${option}`}
              accessibilityRole="tab"
              accessibilityLabel={badge ? `${label}, ${t('buddies.segments.incoming', { count: incoming })}` : label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) {
                  haptics.selection();
                  setTab(option);
                }
              }}
              style={[layout.pill, selected ? styles.selected : null]}
            >
              <AppText variant="small" tone={selected ? 'ink' : 'muted'}>
                {label}
              </AppText>
              {badge ? (
                <View testID="buddies.incoming-badge" style={[layout.badge, styles.badge]}>
                  <AppText variant="caption" tone="white">
                    {incoming}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen testID="buddies.screen" showOfflineBanner>
      {tab === 'find' ? <FindTab header={header} /> : <MineTab header={header} />}
    </Screen>
  );
}

const layout = StyleSheet.create({
  top: { gap: spacing[16] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  title: { flex: 1 },
  track: { flexDirection: 'row', padding: spacing[4], gap: spacing[4], borderRadius: radii.pill },
  pill: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing[6],
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  badge: {
    minWidth: sizes.chipHeight - spacing[6],
    paddingHorizontal: spacing[6],
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  track: { backgroundColor: c.soft },
  selected: { backgroundColor: c.card },
  badge: { backgroundColor: c.red700 },
}));
