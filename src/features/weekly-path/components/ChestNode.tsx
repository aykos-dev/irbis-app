import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import type { PathChestDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { pathColors } from '../../../shared/constants/colors';
import { radii, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { useOpenChest } from '../hooks/useOpenChest';
import { CANVAS_WIDTH, chestMotion, chestSize, nodeSize } from '../pathLayout';

type Props = { chest: PathChestDto; month: string; x: number; y: number; canvasX: number };

const VIEWBOX = '0 0 48 40';
const SPARKLES = Array.from({ length: chestMotion.sparkles }, (_, i) => i);

function Sparkle({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (Math.PI * 2 * index) / chestMotion.sparkles - Math.PI / 2;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * chestMotion.sparkleSpread * progress.value },
      { translateY: Math.sin(angle) * chestMotion.sparkleSpread * progress.value },
      { scale: 1 + progress.value },
    ],
  }));
  return <Animated.View style={[layout.sparkle, style]} />;
}

/**
 * The monthly chest at the end of the path (AC5): progress, tap to open once every place is
 * checked in (lid tilt + sparkle placeholder), the open chest afterwards.
 */
export function ChestNode({ chest, month, x, y, canvasX }: Props) {
  const reducedMotion = useReducedMotion();
  const [justOpened, setJustOpened] = useState(false);
  const opened = chest.opened || justOpened;
  const lid = useSharedValue(0);
  const sparkle = useSharedValue(1);
  const shake = useSharedValue(0);

  const { press } = useOpenChest({
    chest,
    month,
    onLocked: () => {
      if (!reducedMotion) {
        const step = { duration: chestMotion.shakeMs };
        shake.value = withSequence(
          withTiming(-chestMotion.shakeX, step),
          withTiming(chestMotion.shakeX, step),
          withTiming(-chestMotion.shakeX, step),
          withTiming(0, step),
        );
      }
    },
    onOpened: () => {
      setJustOpened(true);
      if (reducedMotion) {
        lid.value = 1;
        return;
      }
      const timing = { duration: chestMotion.lidMs, easing: Easing.out(Easing.back(2)) };
      lid.value = withTiming(1, timing);
      sparkle.value = 0;
      sparkle.value = withTiming(1, { duration: chestMotion.lidMs * 2 });
    },
  });

  // `chest.opened` from a response keeps the lid up without replaying the animation.
  const openedOnServer = chest.opened ? 1 : 0;
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const lidStyle = useAnimatedStyle(() => {
    const p = Math.max(lid.value, openedOnServer);
    return {
      transform: [{ translateY: chestMotion.lidLift * p }, { rotate: `${chestMotion.lidDeg * p}deg` }],
    };
  }, [openedOnServer]);

  const progress = t('path.chest.progress', { done: chest.done, required: chest.required });
  const label = opened ? t('path.chest.opened') : progress;
  const labelRight = canvasX < CANVAS_WIDTH / 2;
  const halfW = chestSize.width / 2;
  return (
    <>
      <Animated.View style={[layout.box, { left: x - halfW, top: y - chestSize.height / 2 }, shakeStyle]}>
        <Pressable
          testID="path.chest"
          accessibilityRole="button"
          accessibilityLabel={label}
          feedback="none"
          onPress={press}
          style={layout.tile}
        >
          <View style={layout.glyph}>
            <Svg width={chestSize.glyphWidth} height={chestSize.glyphHeight} viewBox={VIEWBOX}>
              <Rect x="4" y="14" width="40" height="24" rx="5" fill={pathColors.chestBody} />
              <Rect x="4" y="16" width="40" height="5" fill={pathColors.chestBand} />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, lidStyle]}>
              <Svg width={chestSize.glyphWidth} height={chestSize.glyphHeight} viewBox={VIEWBOX}>
                <Path d="M4 18 Q4 4 24 4 Q44 4 44 18Z" fill={pathColors.chestLid} />
                <Rect x="20" y="14" width="8" height="12" rx="2" fill={pathColors.chestBand} />
              </Svg>
            </Animated.View>
          </View>
          {justOpened && !reducedMotion ? (
            <View pointerEvents="none" style={layout.sparkles} importantForAccessibility="no-hide-descendants">
              {SPARKLES.map(index => (
                <Sparkle key={index} index={index} progress={sparkle} />
              ))}
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
      <View
        style={[
          layout.label,
          { top: y - chestSize.height / 2 + spacing[8] },
          labelRight
            ? { left: x + halfW + nodeSize.labelGap }
            : { left: x - halfW - nodeSize.labelGap - nodeSize.labelWidth },
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant="small" style={labelRight ? null : layout.textEnd}>
          {progress}
        </AppText>
        {opened ? (
          <AppText variant="small" tone="ink" style={labelRight ? null : layout.textEnd}>
            {t('path.chest.opened')}
          </AppText>
        ) : null}
      </View>
    </>
  );
}

const layout = StyleSheet.create({
  box: { position: 'absolute', width: chestSize.width, height: chestSize.height },
  tile: {
    width: chestSize.width,
    height: chestSize.height,
    borderRadius: radii.card,
    backgroundColor: pathColors.chestTile,
    borderBottomWidth: chestSize.edge,
    borderBottomColor: pathColors.chestEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: chestSize.glyphWidth, height: chestSize.glyphHeight },
  sparkles: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  sparkle: {
    position: 'absolute',
    width: chestMotion.sparkle,
    height: chestMotion.sparkle,
    borderRadius: radii.pill,
    backgroundColor: pathColors.sparkle,
  },
  label: { position: 'absolute', width: nodeSize.labelWidth, gap: spacing[4] },
  textEnd: { textAlign: 'right' },
});
