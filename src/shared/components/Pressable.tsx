import {
  Platform,
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '../constants/spacing';
import { useTheme } from '../contexts/theme';

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /**
   * `scale` (default): 0.97 scale + 0.9 opacity, 150 ms; Material ripple on Android.
   * `none`: the caller draws its own pressed state (e.g. AppButton's press-down).
   */
  feedback?: 'scale' | 'none';
  testID: string;
  accessibilityLabel: string;
};

const timing = { duration: motion.press, easing: Easing.out(Easing.cubic) };

/** The only touchable primitive features may use (engineering-standards §1, §8). */
export function Pressable({
  feedback = 'scale',
  style,
  onPressIn,
  onPressOut,
  disabled,
  accessibilityRole = 'button',
  accessibilityState,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (feedback === 'none') {
      return {};
    }
    const scale = reducedMotion ? 1 : 1 - (1 - motion.pressScale) * pressed.value;
    return {
      opacity: 1 - (1 - motion.pressOpacity) * pressed.value,
      transform: [{ scale }],
    };
  });

  const handlePressIn = (event: GestureResponderEvent) => {
    pressed.value = withTiming(1, timing);
    onPressIn?.(event);
  };
  const handlePressOut = (event: GestureResponderEvent) => {
    pressed.value = withTiming(0, timing);
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      android_ripple={
        Platform.OS === 'android' && feedback === 'scale'
          ? { color: colors.soft, borderless: false }
          : undefined
      }
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
