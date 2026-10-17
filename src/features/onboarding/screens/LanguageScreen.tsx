import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OnboardingStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Mascot } from '../../../shared/components/Mascot';
import { Motion } from '../../../shared/components/Motion';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { languageNames, setLocale, supportedLocales, t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { useEndOnboarding } from '../hooks/useEndOnboarding';
import { useOnboardingStep } from '../hooks/useOnboardingStep';

const MASCOT_SIZE = 96;
const CHECK = 22;

/** O3 — Language (AC3): applies at once, Continue always enabled. */
export function LanguageScreen({ navigation }: OnboardingStackScreenProps<'Language'>) {
  const current = useLocale();
  const { colors } = useTheme();
  const styles = useStyles();
  const end = useEndOnboarding();
  const [nods, setNods] = useState(0);
  useOnboardingStep('language');

  const choose = (locale: Locale) => {
    haptics.selection();
    setLocale(locale);
    setNods(count => count + 1);
    qaLog('onboarding_language', { locale });
  };

  return (
    <Screen testID="onboarding.language" scroll>
      <OnboardingHeader step={1} onBack={() => navigation.goBack()} onClose={() => end('close')} />
      <View style={layout.welcome}>
        <Motion
          key={nods}
          name="irbis-nod"
          size={MASCOT_SIZE}
          fallback={<Mascot kind="default" size={MASCOT_SIZE} />}
        />
        <View style={styles.bubble}>
          <AppText variant="h3">{t('onboarding.language.bubble')}</AppText>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={layout.rows}>
        {supportedLocales.map(locale => {
          const selected = locale === current;
          return (
            <Pressable
              key={locale}
              testID={`onboarding.lang-${locale}`}
              accessibilityRole="radio"
              accessibilityLabel={languageNames[locale]}
              accessibilityHint={t(`onboarding.language.sub.${locale}`)}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => choose(locale)}
              style={[styles.row, selected && styles.rowSelected]}
            >
              <View style={[styles.badge, selected && styles.badgeSelected]}>
                <AppText variant="chip" tone={selected ? 'white' : 'teal700'}>
                  {locale.toUpperCase()}
                </AppText>
              </View>
              <View style={layout.rowText}>
                <AppText variant="h3">{languageNames[locale]}</AppText>
                <AppText variant="small">{t(`onboarding.language.sub.${locale}`)}</AppText>
              </View>
              {selected ? <Icon name="check" color={colors.teal700} size={CHECK} /> : null}
            </Pressable>
          );
        })}
      </View>
      <AppText variant="small" style={layout.centered}>
        {t('onboarding.language.footnote')}
      </AppText>
      <View style={layout.grow} />
      <AppButton testID="onboarding.continue" label={t('onboarding.continue')} onPress={() => end('finish')} />
    </Screen>
  );
}

const layout = StyleSheet.create({
  welcome: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[10] },
  rows: { gap: spacing[12] },
  rowText: { flex: 1, gap: spacing[4] },
  centered: { textAlign: 'center' },
  grow: { flexGrow: 1 },
});

const useStyles = createThemedStyles(c => ({
  bubble: {
    flex: 1,
    marginBottom: spacing[22],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: sizes.buttonMinHeight,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  rowSelected: { borderColor: c.teal, backgroundColor: c.navActiveBg },
  badge: {
    minWidth: sizes.iconTile,
    height: sizes.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.checkbox,
    backgroundColor: c.tealTint,
  },
  badgeSelected: { backgroundColor: c.teal700 },
}));
