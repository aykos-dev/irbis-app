import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';

import { companionL2SilhouetteSvg } from '../../../assets/svg/companionL2Silhouette';
import { companionL3SilhouetteSvg } from '../../../assets/svg/companionL3Silhouette';
import { companionL4SilhouetteSvg } from '../../../assets/svg/companionL4Silhouette';
import { companionL5SilhouetteSvg } from '../../../assets/svg/companionL5Silhouette';
import { companionL6SilhouetteSvg } from '../../../assets/svg/companionL6Silhouette';
import { companionL7SilhouetteSvg } from '../../../assets/svg/companionL7Silhouette';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Motion } from '../../../shared/components/Motion';
import { Screen } from '../../../shared/components/Screen';
import { levelColors } from '../../../shared/constants/colors';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { CompanionReveal, PANDA_SIZE } from '../components/CompanionReveal';
import { useEndOnboarding } from '../hooks/useEndOnboarding';
import { useOnboardingStep } from '../hooks/useOnboardingStep';

const CLAP_SIZE = 64;
const SILHOUETTE = 40;
const SILHOUETTE_OPACITY = 0.18;
const SUNBURST_RAYS = 12;
const SUNBURST_OPACITY = 0.12;
/** Sunburst geometry in its 200 × 200 viewBox; rays overshoot the corners. */
const SUN_CENTER = 100;
const SUN_RAY = 150;
const ELLIPSE_WIDTH = 220;
const ELLIPSE_HEIGHT = 48;
const ELLIPSE_BOTTOM = 8;
const STARTING_LEVEL = 1;

const silhouettes = [
  companionL2SilhouetteSvg,
  companionL3SilhouetteSvg,
  companionL4SilhouetteSvg,
  companionL5SilhouetteSvg,
  companionL6SilhouetteSvg,
  companionL7SilhouetteSvg,
];

/** Twelve alternate wedges around the centre of a 200 × 200 box. */
const sunburstPath = Array.from({ length: SUNBURST_RAYS }, (_, index) => {
  const step = Math.PI / SUNBURST_RAYS;
  const from = index * 2 * step;
  const to = from + step;
  const point = (angle: number) =>
    `${(SUN_CENTER + SUN_RAY * Math.cos(angle)).toFixed(1)} ${(SUN_CENTER + SUN_RAY * Math.sin(angle)).toFixed(1)}`;
  return `M${SUN_CENTER} ${SUN_CENTER} L${point(from)} L${point(to)} Z`;
}).join(' ');

/** O6 — Companion reveal (AC6): no header; Android back returns to Interests. */
export function CompanionScreen() {
  const { colors } = useTheme();
  const end = useEndOnboarding();
  useOnboardingStep('companion');

  useEffect(() => {
    haptics.success();
  }, []);

  return (
    <Screen testID="onboarding.companion" scroll>
      <View style={layout.stage}>
        <Svg
          viewBox="0 0 200 200"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path d={sunburstPath} fill={colors.teal} fillOpacity={SUNBURST_OPACITY} />
        </Svg>
        <View style={layout.ellipse} />
        <Motion name="onb5-reveal" size={PANDA_SIZE} fallback={<CompanionReveal />} />
        <View style={layout.clap}>
          <Motion
            name="irbis-clap"
            size={CLAP_SIZE}
            fallback={<Mascot kind="excited" size={CLAP_SIZE} />}
          />
        </View>
      </View>
      <View style={layout.text}>
        <AppText variant="caption" tone="teal700" style={layout.centered}>
          {t('onboarding.companion.eyebrow')}
        </AppText>
        <AppText variant="h1" accessibilityRole="header" style={layout.centered}>
          {t('onboarding.companion.title')}
        </AppText>
        <View style={layout.pill}>
          <View style={layout.levelBadge}>
            <AppText variant="chip" tone="white">
              {String(STARTING_LEVEL)}
            </AppText>
          </View>
          <AppText variant="chip" style={layout.pillText}>
            {`${t('onboarding.companion.level')} · ${t('onboarding.companion.trait')}`}
          </AppText>
        </View>
        <AppText style={layout.centered}>{t('onboarding.companion.body')}</AppText>
      </View>
      <View
        accessible
        accessibilityLabel={t('onboarding.companion.locked')}
        style={layout.silhouettes}
      >
        {silhouettes.map((xml, index) => (
          <SvgXml
            key={index}
            xml={xml}
            width={SILHOUETTE}
            height={SILHOUETTE}
            color={colors.ink}
            opacity={SILHOUETTE_OPACITY}
          />
        ))}
      </View>
      <View style={layout.grow} />
      <AppButton
        testID="onboarding.lets-go"
        label={t('onboarding.companion.letsGo')}
        onPress={() => end('finish')}
      />
    </Screen>
  );
}

const level = levelColors[STARTING_LEVEL];

const layout = StyleSheet.create({
  stage: {
    alignSelf: 'stretch',
    height: PANDA_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radii.largeCard,
  },
  ellipse: {
    position: 'absolute',
    bottom: ELLIPSE_BOTTOM,
    width: ELLIPSE_WIDTH,
    height: ELLIPSE_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: level.tint,
    borderBottomWidth: spacing[4],
    borderBottomColor: level.color,
  },
  clap: { position: 'absolute', top: 0, right: 0 },
  text: { alignItems: 'center', gap: spacing[8] },
  centered: { textAlign: 'center' },
  levelBadge: {
    minWidth: sizes.chipHeight,
    height: sizes.chipHeight,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: level.color,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingVertical: spacing[4],
    paddingStart: spacing[4],
    paddingEnd: spacing[12],
    borderRadius: radii.pill,
    backgroundColor: level.tint,
  },
  pillText: { color: level.text, flexShrink: 1 },
  silhouettes: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing[8] },
  grow: { flexGrow: 1 },
});
