import { useEffect } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { companionFoxCheeringSvg } from '../../../assets/svg/companionFoxCheering';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { Screen } from '../../../shared/components/Screen';
import { levelUpColors } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { useAuth } from '../../../shared/contexts/auth';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { formatNumber } from '../../../shared/utils/format';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';

/** AC7: confetti plays this long, once. */
export const CONFETTI_MS = 1200;
const CONFETTI_FALL = 160;
const CONFETTI_WIDTH = 10;
const CONFETTI_HEIGHT = 16;
const CONFETTI_RADIUS = 2;
const ART_SIZE = 168;
/** The fox has its own celebration art; other companions use their neutral image. */
const FOX_LEVEL = 3;

const pieces = [
  { left: '10%', top: '6%', rotate: '-18deg' },
  { left: '30%', top: '2%', rotate: '24deg' },
  { left: '50%', top: '8%', rotate: '38deg' },
  { left: '70%', top: '3%', rotate: '-30deg' },
  { left: '88%', top: '7%', rotate: '12deg' },
] as const;

/** A few coloured rects falling and fading once; decorative. */
function Confetti() {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: reducedMotion ? 0 : CONFETTI_MS });
  }, [progress, reducedMotion]);
  const fall = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * CONFETTI_FALL }],
  }));
  return (
    <Animated.View
      testID="summit.confetti"
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, fall]}
    >
      {pieces.map((piece, index) => (
        <View
          key={piece.left}
          style={[
            layout.confetti,
            {
              left: piece.left,
              top: piece.top,
              backgroundColor: levelUpColors.confetti[index % levelUpColors.confetti.length],
              transform: [{ rotate: piece.rotate }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function SummitArt({ level }: { level: number }) {
  if (level === FOX_LEVEL) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={t('checkin.summit.art')}>
        <SvgXml xml={companionFoxCheeringSvg} width={ART_SIZE} height={ART_SIZE} />
      </View>
    );
  }
  return <CompanionArt level={level} size={ART_SIZE} accessibilityLabel={t('checkin.summit.art')} />;
}

/**
 * Summit (AC7): the celebration after a check-in. Sent: "+XP earned" or "Already counted this
 * month"; queued (offline): the waiting line instead of the XP tile. Share and Continue (back).
 */
export function SummitScreen({ navigation, route }: RootStackScreenProps<'Summit'>) {
  const { placeName, placeType, elevationM, queued, counted, xp } = route.params;
  const { user } = useAuth();
  const locale = useLocale();
  const styles = useStyles();
  const title = placeType === 'peak' ? t('checkin.summit.peak') : t('checkin.summit.other');
  const subtitle =
    elevationM === undefined
      ? placeName
      : `${placeName} · ${t('checkin.summit.elevation', { m: formatNumber(elevationM, locale) })}`;

  const share = () => {
    haptics.tap();
    Share.share({ message: t('checkin.summit.shareText', { place: placeName }) }).catch(() => {
      qaLog('check_in_share_failed', {});
    });
  };

  return (
    <View style={layout.fill}>
      <Screen testID="summit.screen" scroll>
        <View style={layout.body}>
          <View style={layout.art}>
            <SummitArt level={user?.level ?? 1} />
          </View>
          <AppText testID="summit.title" variant="h1" accessibilityRole="header" style={layout.center}>
            {title}
          </AppText>
          <AppText testID="summit.place" variant="body" tone="muted" style={layout.center}>
            {subtitle}
          </AppText>
          {queued ? (
            <AppText testID="summit.queued" variant="body" style={layout.center}>
              {t('checkin.summit.queued')}
            </AppText>
          ) : (
            <View testID="summit.xp" style={styles.tile}>
              <AppText variant="h3" style={layout.center}>
                {counted ? t('checkin.summit.xp', { xp }) : t('checkin.summit.notCounted')}
              </AppText>
            </View>
          )}
          <View style={layout.actions}>
            <AppButton testID="summit.share" variant="white" label={t('checkin.summit.share')} onPress={share} />
            <AppButton
              testID="summit.continue"
              label={t('checkin.summit.continue')}
              onPress={() => {
                haptics.tap();
                navigation.goBack();
              }}
            />
          </View>
        </View>
      </Screen>
      <Confetti />
    </View>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  body: { alignItems: 'stretch', gap: spacing[16], paddingTop: spacing[32] },
  art: { alignSelf: 'center' },
  center: { textAlign: 'center' },
  actions: { gap: spacing[12], marginTop: spacing[16] },
  confetti: {
    position: 'absolute',
    width: CONFETTI_WIDTH,
    height: CONFETTI_HEIGHT,
    borderRadius: CONFETTI_RADIUS,
  },
});

const useStyles = createThemedStyles(c => ({
  tile: {
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
