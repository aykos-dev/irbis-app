import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '../../../shared/components/AppText';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

/** How long "+{xp} XP" floats up and fades. */
const FLOAT_MS = 1200;
const FLOAT_DISTANCE = spacing[32];

/** "+{xp} XP" floating up after the server granted it (AC6; mount with a new key per grant). */
export function XpChip({ xp }: { xp: number }) {
  const styles = useStyles();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: FLOAT_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: reducedMotion ? 0 : -FLOAT_DISTANCE * progress.value }],
  }));

  return (
    <Animated.View
      testID="active.waypoint.xp"
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.chip, layout.chip, animated]}
    >
      <AppText variant="chip" tone="onOrange">
        {t('active.waypoint.xp', { xp })}
      </AppText>
    </Animated.View>
  );
}

const layout = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 0,
    end: 0,
    height: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  chip: { backgroundColor: c.orange },
}));
