import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Mascot } from '../../../shared/components/Mascot';
import { pathColors } from '../../../shared/constants/colors';
import { radii, spacing } from '../../../shared/constants/spacing';
import { mascotSize } from '../pathLayout';

const DROPS = [0.2, 0.5, 0.8] as const;
const DROP = { width: 3, height: 8 } as const;
const ease = Easing.inOut(Easing.sin);

/**
 * The worried Irbis beside a not-now node: a gentle sway with a rain loop (Reanimated placeholder
 * until owner art). Reduce motion: still, no rain.
 */
export function WorriedMascot({ testID }: { testID: string }) {
  const reducedMotion = useReducedMotion();
  const sway = useSharedValue(0);
  const fall = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    sway.value = withRepeat(
      withSequence(
        withTiming(mascotSize.swayDeg, { duration: mascotSize.swayMs / 2, easing: ease }),
        withTiming(-mascotSize.swayDeg, { duration: mascotSize.swayMs / 2, easing: ease }),
      ),
      -1,
      true,
    );
    fall.value = withRepeat(withTiming(1, { duration: mascotSize.rainMs, easing: Easing.in(Easing.quad) }), -1);
    return () => {
      cancelAnimation(sway);
      cancelAnimation(fall);
    };
  }, [reducedMotion, sway, fall]);

  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  const rainStyle = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [{ translateY: fall.value * mascotSize.dropFall }],
  }));

  return (
    <View testID={testID} style={layout.root} pointerEvents="none">
      {reducedMotion ? null : (
        <Animated.View style={[layout.rain, rainStyle]}>
          {DROPS.map(left => (
            <View key={left} style={[layout.drop, { left: `${left * 100}%` }]} />
          ))}
        </Animated.View>
      )}
      <Animated.View style={swayStyle}>
        <Mascot kind="worried" size={mascotSize.worried} />
      </Animated.View>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { width: mascotSize.worried, height: mascotSize.worried },
  rain: { ...StyleSheet.absoluteFill, top: -spacing[8] },
  drop: {
    position: 'absolute',
    top: 0,
    width: DROP.width,
    height: DROP.height,
    borderRadius: radii.pill,
    backgroundColor: pathColors.rain,
  },
});
