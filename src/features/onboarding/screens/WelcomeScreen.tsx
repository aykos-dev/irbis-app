import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OnboardingStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { LanguageSheet } from '../../../shared/components/LanguageSheet';
import { Mascot } from '../../../shared/components/Mascot';
import { Motion } from '../../../shared/components/Motion';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { useOnboardingStep } from '../hooks/useOnboardingStep';

const MASCOT_SIZE = 280;
const GLOBE = 18;

/** O2 — Meet Irbis (AC2). */
export function WelcomeScreen({ navigation }: OnboardingStackScreenProps<'Welcome'>) {
  const locale = useLocale();
  const { colors } = useTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  useOnboardingStep('welcome');

  return (
    <Screen testID="onboarding.welcome" scroll>
      <View style={layout.top}>
        <Pressable
          testID="onboarding.lang-chip"
          accessibilityLabel={t('onboarding.welcome.langChip')}
          onPress={() => {
            setSheetClosing(false);
            setSheetOpen(true);
          }}
          style={styles.chip}
        >
          <Icon name="globe" color={colors.teal700} size={GLOBE} />
          <AppText variant="chip" tone="teal700">
            {locale.toUpperCase()}
          </AppText>
        </Pressable>
      </View>
      <View style={styles.bubble}>
        <AppText variant="h3">{t('onboarding.welcome.bubble')}</AppText>
      </View>
      <View style={layout.mascot}>
        <Motion
          name="irbis-wave"
          size={MASCOT_SIZE}
          fallback={<Mascot kind="excited" size={MASCOT_SIZE} />}
        />
      </View>
      <AppText variant="h1" accessibilityRole="header" style={layout.centered}>
        {t('onboarding.welcome.title')}
      </AppText>
      <AppText variant="body" style={layout.centered}>
        {t('onboarding.welcome.body')}
      </AppText>
      <View style={layout.grow} />
      <View style={layout.actions}>
        <AppButton
          testID="onboarding.get-started"
          label={t('onboarding.welcome.getStarted')}
          onPress={() => navigation.navigate('Language')}
        />
        <AppButton
          testID="onboarding.have-account"
          label={t('onboarding.welcome.haveAccount')}
          variant="white"
          onPress={() => navigation.navigate('Auth', { screen: 'LogIn' })}
        />
      </View>
      {sheetOpen ? (
        <LanguageSheet
          closing={sheetClosing}
          onPick={() => setSheetClosing(true)}
          onDismiss={() => {
            setSheetOpen(false);
            setSheetClosing(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

const layout = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  mascot: { alignItems: 'center' },
  centered: { textAlign: 'center' },
  grow: { flexGrow: 1 },
  actions: { gap: spacing[14] },
});

const useStyles = createThemedStyles(c => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  bubble: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
}));
