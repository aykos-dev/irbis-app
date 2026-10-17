import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import type { OnboardingStackScreenProps } from '../../../app/navigation/types';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { palette } from '../../../shared/constants/colors';
import { radii, screenPadding, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { useOnboardingStep } from '../hooks/useOnboardingStep';

/** How long the splash stays before Welcome replaces it. */
export const SPLASH_MS = 1500;

const MASCOT_SIZE = 200;
/** The white-12% halo behind the mascot (canvas Splash). */
const HALO_SIZE = 248;
const HALO_OPACITY = 0.12;
const DOT_SIZE = 8;
const DOT_DIM = 0.45;
const DOTS = [0, 1, 2] as const;

/** O1 — Splash: brand teal, Irbis in a halo, wordmark, tagline, three dots; then Welcome. */
export function SplashScreen({ navigation }: OnboardingStackScreenProps<'Splash'>) {
  useOnboardingStep('splash');

  useEffect(() => {
    const timer = setTimeout(() => navigation.replace('Welcome'), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View testID="onboarding.splash" style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.halo}>
        <View style={styles.haloFill} />
        <Mascot kind="default" size={MASCOT_SIZE} />
      </View>
      <AppText variant="stat" tone="white" accessibilityRole="header">
        {t('onboarding.splash.wordmark')}
      </AppText>
      <AppText variant="body" tone="white" style={styles.centered}>
        {t('onboarding.splash.tagline')}
      </AppText>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {DOTS.map(dot => (
          <View key={dot} style={[styles.dot, dot > 0 && styles.dotDim]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[16],
    paddingHorizontal: screenPadding,
    backgroundColor: palette.tealIconEdge,
  },
  halo: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: radii.pill,
    backgroundColor: palette.white,
    opacity: HALO_OPACITY,
  },
  centered: { textAlign: 'center' },
  dots: { flexDirection: 'row', gap: spacing[8], marginTop: spacing[24] },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: radii.pill, backgroundColor: palette.white },
  dotDim: { opacity: DOT_DIM },
});
