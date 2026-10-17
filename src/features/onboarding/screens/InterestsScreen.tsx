import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { OnboardingStackScreenProps } from '../../../app/navigation/types';
import { interestCampingSvg } from '../../../assets/svg/interestCamping';
import { interestCavesSvg } from '../../../assets/svg/interestCaves';
import { interestLakesSvg } from '../../../assets/svg/interestLakes';
import { interestPeaksSvg } from '../../../assets/svg/interestPeaks';
import { interestTrailsSvg } from '../../../assets/svg/interestTrails';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Mascot } from '../../../shared/components/Mascot';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { palette, placeTypeColors } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { IrbisBubble } from '../components/IrbisBubble';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { useEndOnboarding } from '../hooks/useEndOnboarding';
import { useOnboardingStep } from '../hooks/useOnboardingStep';
import { interests, saveInterests, type Interest } from '../onboardingStore';

const MASCOT_SIZE = 96;
const GLYPH = 28;
const BOX = 26;
const CHECK = 18;

const tiles: Record<Interest, { glyph: string; color: string }> = {
  peaks: { glyph: interestPeaksSvg, color: placeTypeColors.peak },
  caves: { glyph: interestCavesSvg, color: placeTypeColors.cave },
  lakes: { glyph: interestLakesSvg, color: placeTypeColors.lake },
  camping: { glyph: interestCampingSvg, color: placeTypeColors.camping },
  trails: { glyph: interestTrailsSvg, color: placeTypeColors.trail },
};

/** O5 — Interests (AC5): toggle tiles, at least one, saved on Continue. */
export function InterestsScreen({ navigation }: OnboardingStackScreenProps<'Interests'>) {
  const styles = useStyles();
  const end = useEndOnboarding();
  const [chosen, setChosen] = useState<Interest[]>([]);
  useOnboardingStep('interests');

  const toggle = (interest: Interest) => {
    haptics.selection();
    setChosen(current =>
      current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest],
    );
  };

  const next = () => {
    if (chosen.length === 0) {
      return;
    }
    saveInterests(chosen);
    navigation.navigate('Companion');
  };

  return (
    <Screen testID="onboarding.interests" scroll>
      <OnboardingHeader step={3} onBack={() => navigation.goBack()} onClose={() => end('close')} />
      <IrbisBubble
        mascot={<Mascot kind="excited" size={MASCOT_SIZE} />}
        text={t('onboarding.interests.bubble')}
      />
      <View style={layout.grid}>
        {interests.map(interest => {
          const selected = chosen.includes(interest);
          const { glyph, color } = tiles[interest];
          const label = t(`onboarding.interests.${interest}`);
          return (
            <Pressable
              key={interest}
              testID={`onboarding.interest-${interest}`}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(interest)}
              style={[
                styles.tile,
                interest === 'trails' ? layout.full : layout.half,
                selected && styles.tileSelected,
              ]}
            >
              <View style={[layout.circle, { backgroundColor: color }]}>
                <SvgXml xml={glyph} width={GLYPH} height={GLYPH} color={palette.white} />
              </View>
              <AppText variant="h3">{label}</AppText>
              <View style={[layout.box, selected ? styles.boxOn : styles.boxOff]}>
                {selected ? <Icon name="check" color={palette.white} size={CHECK} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppText
        testID="onboarding.interests-count"
        variant="small"
        accessibilityLiveRegion="polite"
        style={layout.centered}
      >
        {`${t('onboarding.interests.count', { count: chosen.length })} · ${t('onboarding.interests.hint')}`}
      </AppText>
      <View style={layout.grow} />
      <AppButton
        testID="onboarding.continue"
        label={t('onboarding.continue')}
        disabled={chosen.length === 0}
        onPress={next}
      />
    </Screen>
  );
}

const layout = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing[12] },
  half: { width: '48%' },
  full: { width: '100%' },
  circle: {
    width: sizes.placeTypeDot,
    height: sizes.placeTypeDot,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    position: 'absolute',
    top: spacing[8],
    right: spacing[8],
    width: BOX,
    height: BOX,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  grow: { flexGrow: 1 },
});

const useStyles = createThemedStyles(c => ({
  tile: {
    gap: spacing[10],
    padding: spacing[16],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  tileSelected: { borderColor: c.teal, backgroundColor: c.navActiveBg },
  boxOn: { backgroundColor: c.teal },
  boxOff: { backgroundColor: c.card, borderWidth: borders.card, borderColor: c.line },
}));
