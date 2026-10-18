import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, SvgXml } from 'react-native-svg';

import { backpackPlaceholderSvg } from '../../../assets/svg/backpackPlaceholder';
import { levelupCatchL4Svg } from '../../../assets/svg/levelupCatchL4';
import { levelupHandL3Svg } from '../../../assets/svg/levelupHandL3';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { Pressable } from '../../../shared/components/Pressable';
import { levelUpColors } from '../../../shared/constants/colors';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

/** Timeline (ms), canvas note `n_lvlup`: glow → backpack arc → white flash → new companion. */
export const SEQUENCE_MS = 3000;
export const SKIP_AFTER_MS = 1000;
const GLOW_END = 800;
const ARC_END = 1800;
const FLASH_END = 2100;
const FLASH_HALF = (FLASH_END - ARC_END) / 2;
const GLOW_SCALE = 1.06;
const GLOW_OPACITY = 0.6;

/** Stage: old companion on the left, new on the right, the backpack arcs between them. */
const STAGE_WIDTH = 320;
const STAGE_HEIGHT = 220;
const ART = 140;
const BACKPACK = 56;
const ART_TOP = 60;
const OLD_X = 0;
const NEW_X = STAGE_WIDTH - ART;
const ARC_START_X = ART / 2;
const ARC_END_X = STAGE_WIDTH - ART / 2;
const ARC_Y = ART_TOP + ART / 3;
const ARC_PEAK_Y = 0;
const PATH_WIDTH = 3;
const PATH_DASH = '2 8';
const PATH_OPACITY = 0.7;

type Props = {
  fromLevel: number;
  toLevel: number;
  /** Reduce motion: the end state at once, nothing animates. */
  reducedMotion: boolean;
  /** The sequence reached its end (played out or skipped). */
  onDone: () => void;
  /** A tap after `SKIP_AFTER_MS` skipped to the end; `atMs` since the start. */
  onSkip: (atMs: number) => void;
};

/** L3 → L4 has the hand-over poses; every other transition shows the neutral companions. */
function OldArt({ from, to }: { from: number; to: number }) {
  if (from === 3 && to === 4) {
    return <SvgXml xml={levelupHandL3Svg} width={ART} height={ART} />;
  }
  return <CompanionArt level={from} size={ART} />;
}

function NewArt({ from, to }: { from: number; to: number }) {
  if (from === 3 && to === 4) {
    return <SvgXml xml={levelupCatchL4Svg} width={ART} height={ART} />;
  }
  return <CompanionArt level={to} size={ART} />;
}

/** Point on the quadratic arc from the old companion to the new one, t in 0…1. */
function arcPoint(progress: number): { x: number; y: number } {
  'worklet';
  const controlX = STAGE_WIDTH / 2;
  const inverse = 1 - progress;
  const x = inverse * inverse * ARC_START_X + 2 * inverse * progress * controlX + progress * progress * ARC_END_X;
  const y = inverse * inverse * ARC_Y + 2 * inverse * progress * ARC_PEAK_Y + progress * progress * ARC_Y;
  return { x, y };
}

const arcPath = `M${ARC_START_X} ${ARC_Y} Q${STAGE_WIDTH / 2} ${ARC_PEAK_Y} ${ARC_END_X} ${ARC_Y}`;

/**
 * Reanimated placeholder for the `levelup-evolution` Lottie (MEDIA.md, AC7): 3 s, skippable by a
 * tap once 1 s has passed. Success haptic at the white flash.
 */
export function EvolutionSequence({ fromLevel, toLevel, reducedMotion, onDone, onSkip }: Props) {
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const glow = useSharedValue(reducedMotion ? 1 : 0);
  const oldOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const arc = useSharedValue(reducedMotion ? 1 : 0);
  const flash = useSharedValue(0);
  const newScale = useSharedValue(reducedMotion ? 1 : 0);

  const finish = useCallback(() => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    onDoneRef.current();
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      haptics.success();
      finish();
      return;
    }
    glow.value = withTiming(1, { duration: GLOW_END, easing: Easing.out(Easing.quad) });
    arc.value = withDelay(GLOW_END, withTiming(1, { duration: ARC_END - GLOW_END, easing: Easing.inOut(Easing.quad) }));
    flash.value = withDelay(
      ARC_END,
      withSequence(withTiming(1, { duration: FLASH_HALF }), withTiming(0, { duration: FLASH_HALF })),
    );
    newScale.value = withDelay(FLASH_END, withSpring(1));
    oldOpacity.value = withDelay(FLASH_END, withTiming(0, { duration: SEQUENCE_MS - FLASH_END }));
    timers.current = [setTimeout(() => haptics.success(), ARC_END), setTimeout(finish, SEQUENCE_MS)];
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reducedMotion, finish, glow, arc, flash, newScale, oldOpacity]);

  const skip = () => {
    const atMs = Date.now() - startedAt.current;
    if (finished.current || atMs < SKIP_AFTER_MS) {
      return;
    }
    [glow, arc, flash, newScale, oldOpacity].forEach(value => cancelAnimation(value));
    glow.value = 1;
    arc.value = 1;
    flash.value = 0;
    newScale.value = 1;
    oldOpacity.value = 0;
    onSkip(atMs);
    finish();
  };

  const oldStyle = useAnimatedStyle(() => ({
    opacity: oldOpacity.value,
    transform: [{ scale: 1 + (GLOW_SCALE - 1) * glow.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: GLOW_OPACITY * glow.value * oldOpacity.value }));
  const backpackStyle = useAnimatedStyle(() => {
    const point = arcPoint(arc.value);
    const visible = arc.value > 0 && arc.value < 1;
    return {
      opacity: visible ? 1 : 0,
      transform: [{ translateX: point.x - BACKPACK / 2 }, { translateY: point.y - BACKPACK / 2 }],
    };
  });
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const newStyle = useAnimatedStyle(() => ({ transform: [{ scale: newScale.value }] }));

  return (
    <Pressable
      testID="levelup.sequence"
      feedback="none"
      accessibilityRole="button"
      accessibilityHint={t('levels.up.skipHint')}
      accessibilityLabel={t('levels.up.skipHint')}
      onPress={skip}
      style={layout.stage}
    >
      <Svg width={STAGE_WIDTH} height={STAGE_HEIGHT} style={StyleSheet.absoluteFill}>
        <Path
          d={arcPath}
          fill="none"
          stroke={levelUpColors.path}
          strokeWidth={PATH_WIDTH}
          strokeDasharray={PATH_DASH}
          strokeLinecap="round"
          opacity={PATH_OPACITY}
        />
      </Svg>
      <Animated.View style={[layout.art, layout.old, oldStyle]}>
        <Animated.View style={[layout.glow, glowStyle]} />
        <OldArt from={fromLevel} to={toLevel} />
      </Animated.View>
      <Animated.View style={[layout.art, layout.new, newStyle]}>
        <NewArt from={fromLevel} to={toLevel} />
      </Animated.View>
      <Animated.View style={[layout.backpack, backpackStyle]}>
        <SvgXml xml={backpackPlaceholderSvg} width={BACKPACK} height={BACKPACK} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[layout.flash, flashStyle]} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  stage: { width: STAGE_WIDTH, height: STAGE_HEIGHT, alignSelf: 'center' },
  art: { position: 'absolute', top: ART_TOP, width: ART, height: ART },
  old: { left: OLD_X },
  new: { left: NEW_X },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: ART / 2,
    backgroundColor: levelUpColors.glow,
  },
  backpack: { position: 'absolute', left: 0, top: 0 },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: levelUpColors.flash },
});
