import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { t } from '../../../../shared/i18n';
import { geoScreenColors, geoScreenSizes } from '../../campTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CENTER = geoScreenSizes.ring / 2;
const RADIUS = (geoScreenSizes.ring - geoScreenSizes.ringStroke) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const secondsLeft = (deadline: number) =>
  Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/** Whole seconds left, counted down on this phone from the host's `remainingMs` (no clock sync). */
export function useSecondsLeft(remainingMs: number): number {
  const [seconds, setSeconds] = useState(() => Math.ceil(remainingMs / 1000));
  useEffect(() => {
    const deadline = Date.now() + remainingMs;
    setSeconds(secondsLeft(deadline));
    const ticker = setInterval(() => {
      const next = secondsLeft(deadline);
      setSeconds(next);
      if (next === 0) {
        clearInterval(ticker);
      }
    }, geoScreenSizes.tickMs);
    return () => clearInterval(ticker);
  }, [remainingMs]);
  return seconds;
}

type Props = {
  remainingMs: number;
  totalMs: number;
};

/** The question timer: a draining ring and the seconds, in the warning colour for the last 5 s. Display only. */
export function GeoTimerRing({ remainingMs, totalMs }: Props) {
  const seconds = useSecondsLeft(remainingMs);
  const progress = useSharedValue(Math.min(1, remainingMs / totalMs));

  useEffect(() => {
    progress.value = Math.min(1, remainingMs / totalMs);
    progress.value = withTiming(0, {
      duration: remainingMs,
      easing: Easing.linear,
    });
    return () => cancelAnimation(progress);
  }, [remainingMs, totalMs, progress]);

  const ring = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));
  const warning = seconds <= geoScreenSizes.warnFromSec;
  const color = warning ? geoScreenColors.warning : geoScreenColors.ring;

  return (
    <View
      testID="geo.timer"
      accessible
      accessibilityRole="timer"
      accessibilityLabel={t('camp.geo.secondsLeft', { n: seconds })}
      style={layout.root}
    >
      <Svg
        width={geoScreenSizes.ring}
        height={geoScreenSizes.ring}
        viewBox={`0 0 ${geoScreenSizes.ring} ${geoScreenSizes.ring}`}
      >
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={geoScreenColors.track}
          strokeWidth={geoScreenSizes.ringStroke}
          fill="none"
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={color}
          strokeWidth={geoScreenSizes.ringStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={ring}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </Svg>
      <View style={layout.center}>
        <AppText variant="h3" style={warning ? layout.warning : undefined}>
          {seconds}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { width: geoScreenSizes.ring, height: geoScreenSizes.ring },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: { color: geoScreenColors.warning },
});
