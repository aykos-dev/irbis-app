import { ActivityIndicator, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { palette, type ThemeColors } from '../constants/colors';
import { borders, motion, radii, sizes } from '../constants/spacing';
import { createThemedStyles } from '../contexts/theme';
import { haptics } from '../utils/haptics';
import { AppText, type TextTone } from './AppText';
import { Pressable } from './Pressable';

export type AppButtonVariant = 'primary' | 'secondary' | 'white' | 'danger';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  testID: string;
  variant?: AppButtonVariant;
  disabled?: boolean;
  /** Request in flight: shows a spinner and ignores presses (no double submit). */
  loading?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const labelTone: Record<AppButtonVariant, TextTone> = {
  primary: 'white',
  secondary: 'onOrange',
  white: 'teal700',
  danger: 'white',
};

const spinnerColor: Record<AppButtonVariant, string> = {
  primary: palette.white,
  secondary: palette.onOrange,
  white: palette.teal700,
  danger: palette.white,
};

const timing = { duration: motion.press, easing: Easing.out(Easing.cubic) };

/**
 * Design.md button: min-height 54, radius 16, 4 px bottom edge in the edge colour; pressed =
 * edge 0 and translate y +4. Labels wrap, never truncate. Fires `impactLight` on press.
 */
export function AppButton({
  label,
  onPress,
  testID,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const styles = useStyles();
  const pressed = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: motion.pressDepth * pressed.value }],
  }));

  const handlePress = (event: GestureResponderEvent) => {
    if (loading) {
      return;
    }
    haptics.tap();
    onPress(event);
  };

  return (
    <Pressable
      testID={testID}
      feedback="none"
      disabled={disabled}
      accessibilityState={{ busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      onPressIn={() => {
        pressed.value = withTiming(1, timing);
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, timing);
      }}
      onPress={handlePress}
      style={layout.container}
    >
      {!disabled && <View style={[layout.edge, styles[`${variant}Edge`]]} />}
      <Animated.View
        style={[
          layout.face,
          disabled ? styles.disabledFace : styles[`${variant}Face`],
          faceStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={spinnerColor[variant]} />
        ) : (
          <AppText
            variant="button"
            tone={labelTone[variant]}
            style={[layout.label, disabled && styles.disabledLabel]}
          >
            {label}
          </AppText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  edge: {
    ...StyleSheet.absoluteFill,
    top: motion.pressDepth,
    borderRadius: radii.button,
  },
  face: {
    minHeight: sizes.buttonMinHeight,
    marginBottom: motion.pressDepth,
    paddingVertical: sizes.buttonPaddingVertical,
    paddingHorizontal: sizes.buttonPaddingHorizontal,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});

const useStyles = createThemedStyles((c: ThemeColors) => ({
  primaryFace: { backgroundColor: c.teal700 },
  primaryEdge: { backgroundColor: c.teal700Edge },
  secondaryFace: { backgroundColor: c.orange },
  secondaryEdge: { backgroundColor: c.orangeEdge },
  whiteFace: { backgroundColor: c.card, borderWidth: borders.card, borderColor: c.line },
  whiteEdge: { backgroundColor: c.line },
  dangerFace: { backgroundColor: c.red700 },
  dangerEdge: { backgroundColor: c.red700Edge },
  disabledFace: { backgroundColor: c.disabledBg },
  disabledLabel: { color: c.disabledFg },
}));
