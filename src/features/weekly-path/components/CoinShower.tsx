import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { pathColors } from '../../../shared/constants/colors';
import { borders, radii } from '../../../shared/constants/spacing';
import { haptics } from '../../../shared/utils/haptics';
import { coinShower } from '../pathLayout';

const COINS = Array.from({ length: coinShower.count }, (_, i) => i);

function Coin({ index, progress }: { index: number; progress: SharedValue<number> }) {
  // Spread coins evenly left → right of the node centre.
  const dx = ((index / (coinShower.count - 1)) * 2 - 1) * coinShower.spreadX;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Up, then down past the start (a simple arc), fading out at the end.
    const y = -coinShower.rise * 4 * p * (1 - p) + coinShower.fall * p * p;
    return { opacity: 1 - p * p, transform: [{ translateX: dx * p }, { translateY: y }] };
  });
  return <Animated.View style={[layout.coin, style]} />;
}

/**
 * Coins burst out of a node that just turned done (AC4, Reanimated placeholder, ≤ 1.2 s) with a
 * success haptic. Mount it with a fresh `key` per flip; reduced motion keeps the haptic only.
 */
export function CoinShower({ testID }: { testID: string }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    haptics.success();
    if (!reducedMotion) {
      progress.value = withTiming(1, { duration: coinShower.ms, easing: Easing.out(Easing.quad) });
    }
  }, [reducedMotion, progress]);

  if (reducedMotion) {
    return null;
  }
  return (
    <View testID={testID} pointerEvents="none" style={layout.root} importantForAccessibility="no-hide-descendants">
      {COINS.map(index => (
        <Coin key={index} index={index} progress={progress} />
      ))}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  coin: {
    position: 'absolute',
    width: coinShower.size,
    height: coinShower.size,
    borderRadius: radii.pill,
    backgroundColor: pathColors.coin,
    borderWidth: borders.card,
    borderColor: pathColors.coinEdge,
  },
});
