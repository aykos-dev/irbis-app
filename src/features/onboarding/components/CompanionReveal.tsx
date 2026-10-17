import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { backpackPlaceholderSvg } from '../../../assets/svg/backpackPlaceholder';
import { Mascot } from '../../../shared/components/Mascot';
import { palette } from '../../../shared/constants/colors';

export const PANDA_SIZE = 270;
const BACKPACK_SIZE = 120;
/** Backpack: three shakes in 600 ms, then fades while the panda springs in. */
const SHAKES = 3;
const SHAKE_DEG = 8;
const SHAKE_STEP_MS = 50;
const OPEN_MS = 600;
const FADE_MS = 200;
const BACKPACK_GROW = 1.15;
/** Confetti: 12 rects falling for 800 ms once the backpack opens. */
const CONFETTI_COUNT = 12;
const CONFETTI_MS = 800;
const CONFETTI_WIDTH = 8;
const CONFETTI_HEIGHT = 14;
const CONFETTI_RADIUS = 2;
const CONFETTI_FALL = 220;
const CONFETTI_SPIN_DEG = 270;
const CONFETTI_TOP = 24;
const confettiColors = [palette.teal, palette.orange, palette.sky, palette.purple, palette.pine, palette.gold];

/**
 * Placeholder for the `onb5-reveal` Lottie (MEDIA.md): backpack shakes and fades, 12 confetti rects
 * fall, the cheering panda springs in. Reduced motion shows the final frame only (the panda).
 */
export function CompanionReveal() {
  const reducedMotion = useReducedMotion();
  return (
    <View style={layout.stage}>
      {reducedMotion ? null : <Backpack />}
      {reducedMotion
        ? null
        : Array.from({ length: CONFETTI_COUNT }, (_, index) => <Confetti key={index} index={index} />)}
      <Panda animate={!reducedMotion} />
    </View>
  );
}

function Backpack() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(-SHAKE_DEG, { duration: SHAKE_STEP_MS }),
        withTiming(SHAKE_DEG, { duration: SHAKE_STEP_MS * 2 }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      ),
      SHAKES,
    );
    scale.value = withDelay(OPEN_MS, withTiming(BACKPACK_GROW, { duration: FADE_MS }));
    opacity.value = withDelay(OPEN_MS, withTiming(0, { duration: FADE_MS }));
  }, [rotation, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[layout.backpack, style]}>
      <SvgXml xml={backpackPlaceholderSvg} width={BACKPACK_SIZE} height={BACKPACK_SIZE} />
    </Animated.View>
  );
}

function Confetti({ index }: { index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      OPEN_MS,
      withTiming(1, { duration: CONFETTI_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [progress]);

  const left = `${((index + 0.5) / CONFETTI_COUNT) * 100}%` as const;
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 1 - progress.value,
    transform: [
      { translateY: progress.value * CONFETTI_FALL },
      { rotate: `${progress.value * CONFETTI_SPIN_DEG * (index % 2 === 0 ? 1 : -1)}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        layout.confetti,
        { left, backgroundColor: confettiColors[index % confettiColors.length] },
        style,
      ]}
    />
  );
}

function Panda({ animate }: { animate: boolean }) {
  const scale = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (animate) {
      scale.value = withDelay(OPEN_MS, withSpring(1));
    }
  }, [animate, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Mascot kind="pandaCheering" size={PANDA_SIZE} />
    </Animated.View>
  );
}

const layout = StyleSheet.create({
  stage: { width: PANDA_SIZE, height: PANDA_SIZE, alignItems: 'center', justifyContent: 'center' },
  backpack: { position: 'absolute' },
  confetti: {
    position: 'absolute',
    top: CONFETTI_TOP,
    width: CONFETTI_WIDTH,
    height: CONFETTI_HEIGHT,
    borderRadius: CONFETTI_RADIUS,
  },
});
