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
import { haptics } from '../../../../shared/utils/haptics';
import { crocColors, crocSizes } from '../../campTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const CENTER = crocSizes.ring / 2;
const RADIUS = (crocSizes.ring - crocSizes.ringStroke) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  /** Turn time left when the host sent the state; this phone counts down from it. */
  remainingMs: number;
  durationSec: number;
};

const secondsLeft = (deadline: number) =>
  Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * The turn timer on every phone (AC4): a draining ring and the seconds, both in the warning colour
 * for the last 10 s, with a light haptic on each of the last 5. Display only — the host ends the turn.
 */
export function CrocTimer({ remainingMs, durationSec }: Props) {
  const [seconds, setSeconds] = useState(() => Math.ceil(remainingMs / 1000));
  const progress = useSharedValue(
    Math.min(1, remainingMs / (durationSec * 1000)),
  );

  useEffect(() => {
    const deadline = Date.now() + remainingMs;
    let shown = secondsLeft(deadline);
    setSeconds(shown);
    progress.value = Math.min(1, remainingMs / (durationSec * 1000));
    progress.value = withTiming(0, {
      duration: remainingMs,
      easing: Easing.linear,
    });
    const ticker = setInterval(() => {
      const next = secondsLeft(deadline);
      if (next === shown) {
        return;
      }
      shown = next;
      setSeconds(next);
      if (next > 0 && next <= crocSizes.hapticFromSec) {
        haptics.tap();
      }
      if (next === 0) {
        clearInterval(ticker);
      }
    }, crocSizes.tickMs);
    return () => {
      clearInterval(ticker);
      cancelAnimation(progress);
    };
  }, [remainingMs, durationSec, progress]);

  const ring = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));
  const warning = seconds <= crocSizes.warnFromSec;
  const color = warning ? crocColors.warning : crocColors.ring;

  return (
    <View
      testID="croc.timer"
      accessible
      accessibilityRole="timer"
      accessibilityLabel={t('camp.croc.seconds', { n: seconds })}
      style={layout.root}
    >
      <Svg
        width={crocSizes.ring}
        height={crocSizes.ring}
        viewBox={`0 0 ${crocSizes.ring} ${crocSizes.ring}`}
      >
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={crocColors.track}
          strokeWidth={crocSizes.ringStroke}
          fill="none"
        />
        <AnimatedCircle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={color}
          strokeWidth={crocSizes.ringStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={ring}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
      </Svg>
      <View style={layout.center}>
        <AppText
          testID="croc.timer.seconds"
          variant="stat"
          style={warning ? layout.warning : undefined}
        >
          {seconds}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  root: {
    alignSelf: 'center',
    width: crocSizes.ring,
    height: crocSizes.ring,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: { color: crocColors.warning },
});
