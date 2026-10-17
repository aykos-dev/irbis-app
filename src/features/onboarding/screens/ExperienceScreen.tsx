import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { OnboardingStackScreenProps } from '../../../app/navigation/types';
import { bootSvg } from '../../../assets/svg/boot';
import { onb3LakeSvg } from '../../../assets/svg/onb3Lake';
import { onb3PeakSvg } from '../../../assets/svg/onb3Peak';
import { onb3TrailSvg } from '../../../assets/svg/onb3Trail';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { difficultyBootColor } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { IrbisBubble } from '../components/IrbisBubble';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { useEndOnboarding } from '../hooks/useEndOnboarding';
import { useOnboardingStep } from '../hooks/useOnboardingStep';
import { experiences, saveExperience, type Experience } from '../onboardingStore';

const MASCOT_SIZE = 96;
const ART_WIDTH = 96;
const ART_HEIGHT = 72;
const BOOT = 16;
const BOOTS_MAX = 4;

const tiles: Record<Experience, { art: string; boots: number }> = {
  beginner: { art: onb3TrailSvg, boots: 1 },
  weekend: { art: onb3LakeSvg, boots: 2 },
  experienced: { art: onb3PeakSvg, boots: 4 },
};

/** O4 — Experience (AC4): one required choice, saved on Continue. */
export function ExperienceScreen({ navigation }: OnboardingStackScreenProps<'Experience'>) {
  const { colors } = useTheme();
  const styles = useStyles();
  const end = useEndOnboarding();
  const [choice, setChoice] = useState<Experience | null>(null);
  useOnboardingStep('experience');

  const choose = (experience: Experience) => {
    haptics.selection();
    setChoice(experience);
  };

  const next = () => {
    if (!choice) {
      return;
    }
    saveExperience(choice);
    navigation.navigate('Interests');
  };

  return (
    <Screen testID="onboarding.experience" scroll>
      <OnboardingHeader step={2} onBack={() => navigation.goBack()} onClose={() => end('close')} />
      <IrbisBubble
        mascot={<Mascot kind="default" size={MASCOT_SIZE} />}
        text={t('onboarding.experience.bubble')}
      />
      <View accessibilityRole="radiogroup" style={layout.tiles}>
        {experiences.map(experience => {
          const selected = experience === choice;
          const { art, boots } = tiles[experience];
          const title = t(`onboarding.experience.${experience}.title`);
          const sub = t(`onboarding.experience.${experience}.sub`);
          const bootsLabel = t('onboarding.experience.boots', { n: boots });
          return (
            <Pressable
              key={experience}
              testID={`onboarding.exp-${experience}`}
              accessibilityRole="radio"
              accessibilityLabel={title}
              accessibilityHint={`${sub}. ${bootsLabel}`}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => choose(experience)}
              style={[styles.tile, selected && styles.tileSelected]}
            >
              <View style={styles.art}>
                <SvgXml
                  xml={art}
                  width={ART_WIDTH}
                  height={ART_HEIGHT}
                  preserveAspectRatio="xMidYMid slice"
                />
              </View>
              <View style={layout.text}>
                <AppText variant="h3">{title}</AppText>
                <AppText variant="small">{sub}</AppText>
                <View style={layout.boots}>
                  {Array.from({ length: BOOTS_MAX }, (_, index) => (
                    <SvgXml
                      key={index}
                      xml={bootSvg}
                      width={BOOT}
                      height={BOOT}
                      color={index < boots ? difficultyBootColor : colors.line}
                    />
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.card}>
        <AppText variant="small" tone="onOrange">
          {t('onboarding.experience.quizCard')}
        </AppText>
      </View>
      <View style={layout.grow} />
      <AppButton
        testID="onboarding.continue"
        label={t('onboarding.continue')}
        disabled={!choice}
        onPress={next}
      />
    </Screen>
  );
}

const layout = StyleSheet.create({
  tiles: { gap: spacing[12] },
  text: { flex: 1, gap: spacing[4] },
  boots: { flexDirection: 'row', gap: spacing[4], paddingTop: spacing[4] },
  grow: { flexGrow: 1 },
});

const useStyles = createThemedStyles(c => ({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  tileSelected: { borderColor: c.teal, backgroundColor: c.navActiveBg },
  art: { width: ART_WIDTH, height: ART_HEIGHT, borderRadius: radii.checkbox, overflow: 'hidden' },
  card: {
    borderRadius: radii.tile,
    backgroundColor: c.orangeTint,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
}));
