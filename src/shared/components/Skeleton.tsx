import { useEffect } from 'react';
import { type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { radii } from '../constants/spacing';
import { createThemedStyles } from '../contexts/theme';

type Props = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  testID?: string;
};

/** Pulse: opacity 1 → 0.5 over a layout-length beat; static under reduced motion. */
const PULSE_MIN_OPACITY = 0.5;
const PULSE_DURATION = 900;

/** A content-shaped loading block (engineering-standards §11). Compose several per surface. */
export function Skeleton({ width = '100%', height, radius = radii.tile, testID }: Props) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, { duration: PULSE_DURATION, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { width, height, borderRadius: radius }, animatedStyle]}
    />
  );
}

const useStyles = createThemedStyles(c => ({
  block: { backgroundColor: c.soft },
}));
