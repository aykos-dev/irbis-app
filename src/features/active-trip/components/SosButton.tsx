import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, motion, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';

/** Hold time before SOS fires (AC7). */
export const SOS_HOLD_MS = 3000;

const SIZE = sizes.sosButton;
const STROKE = borders.ring;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = { disabled: boolean; onFire: () => void };

/**
 * Red SOS hold button (AC7): press-in starts a 3 s radial ring; release before it ends cancels and
 * nothing is sent; at 3 s `onFire` runs (the caller gives the heavy haptic and sends).
 */
export function SosButton({ disabled, onFire }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progress.value) }));

  const pressIn = () => {
    fired.current = false;
    haptics.pickUp();
    progress.value = withTiming(1, { duration: SOS_HOLD_MS, easing: Easing.linear });
    timer.current = setTimeout(() => {
      timer.current = null;
      fired.current = true;
      progress.value = 0;
      onFire();
    }, SOS_HOLD_MS);
  };

  const pressOut = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!fired.current) {
      progress.value = withTiming(0, { duration: motion.exit });
      qaLog('sos_hold_cancelled', {});
    }
  };

  return (
    <View style={layout.root}>
      <Pressable
        testID="active.sos"
        accessibilityLabel={t('active.sos.a11y')}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.button, layout.button]}
      >
        <Svg testID="active.sos.ring" width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.white}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <AppText variant="h3" tone="white">
          {t('active.sos.label')}
        </AppText>
      </Pressable>
      <AppText variant="caption">{t('active.sos.hold')}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[4] },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  button: { backgroundColor: c.red700 },
}));
