import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect, SvgXml } from 'react-native-svg';

import type { PathNodeDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import {
  conditionColors,
  palette,
  pathColors,
  shadowColor,
} from '../../../shared/constants/colors';
import { elevation, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { bounce, CANVAS_WIDTH, doneSize, nodeSize } from '../pathLayout';
import type { NodeChip } from '../pathText';
import type { PlaceGlyph } from '../types';
import { CoinShower } from './CoinShower';
import { WorriedMascot } from './WorriedMascot';

type Props = {
  node: PathNodeDto;
  name: string;
  chip: NodeChip | null;
  /** Centre in trail px; `canvasX` decides the label side. */
  x: number;
  y: number;
  canvasX: number;
  type: { color: string; glyph: PlaceGlyph };
  onPress: (node: PathNodeDto) => void;
};

type BadgeStatus = 'go' | 'caution' | 'notNow';

const BADGE_PATH: Record<BadgeStatus, string> = {
  go: 'M5 12.5l4.5 4.5L19 7.5',
  caution: 'M12 6v7M12 17.5v.3',
  notNow: 'M7 7l10 10M17 7L7 17',
};
const BADGE_STROKE = 3.4;
const LOCK_STROKE = 2.6;
const STAR = 'M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z';

export function TypeGlyph({ glyph, color, size }: { glyph: PlaceGlyph; color: string; size: number }) {
  if ('xml' in glyph) {
    return (
      <SvgXml xml={glyph.xml} width={size} height={size} color={color} importantForAccessibility="no-hide-descendants" />
    );
  }
  return <Icon name={glyph.icon} color={color} size={size} />;
}

function Padlock() {
  const color = conditionColors.seasonalLock.chipFg;
  const stroke = { stroke: color, strokeWidth: LOCK_STROKE, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={nodeSize.lockGlyph} height={nodeSize.lockGlyph} viewBox="0 0 24 24">
      <Rect x="5" y="11" width="14" height="10" rx="2.5" {...stroke} />
      <Path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" {...stroke} />
    </Svg>
  );
}

function Badge({ status }: { status: BadgeStatus }) {
  const styles = useStyles();
  return (
    <View style={[styles.badge, { backgroundColor: pathColors.badge[status] }]}>
      <Svg width={nodeSize.badgeGlyph} height={nodeSize.badgeGlyph} viewBox="0 0 24 24">
        <Path
          d={BADGE_PATH[status]}
          stroke={pathColors.badgeGlyph[status]}
          strokeWidth={BADGE_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR} fill={color} />
    </Svg>
  );
}

/** Gold core with a star and its edge (AC4). */
function DoneCore() {
  return (
    <View style={layout.doneBox}>
      <View style={[layout.doneDisc, layout.doneEdge]} />
      <View style={[layout.doneDisc, layout.doneCore]}>
        <Star size={doneSize.star} color={pathColors.doneStar} />
      </View>
    </View>
  );
}

function DoneChip({ testID }: { testID: string }) {
  const { scheme } = useTheme();
  const tone = pathColors.doneChip[scheme];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={t('path.done')}
      style={[layout.doneChip, { backgroundColor: tone.bg }]}
    >
      <Star size={doneSize.chipIcon} color={tone.fg} />
      <AppText variant="chip" style={{ color: tone.fg }}>
        {t('path.done')}
      </AppText>
    </View>
  );
}

/** One place on the path (AC2): status ring, type glyph, badge, name and status chip beside it. */
export function PathNode({ node, name, chip, x, y, canvasX, type, onPress }: Props) {
  const styles = useStyles();
  const { scheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const n = node.position;
  const done = node.done;
  // A node that turns done while on screen gets a coin shower (a fresh key per flip, AC4).
  const [wasDone, setWasDone] = useState(done);
  const [flips, setFlips] = useState(0);
  if (done !== wasDone) {
    setWasDone(done);
    if (done) {
      setFlips(count => count + 1);
    }
  }
  const variant = done ? undefined : chip?.variant;
  const locked = variant === 'seasonalLock';
  const ringColor = variant
    ? scheme === 'dark'
      ? pathColors.ringDark[variant]
      : conditionColors[variant].ring
    : null;
  const labelRight = canvasX < CANVAS_WIDTH / 2;
  const half = nodeSize.ring / 2;

  const bounceStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const press = () => {
    haptics.pickUp();
    if (!reducedMotion) {
      scale.value = withSequence(withTiming(bounce.peak, { duration: bounce.upMs }), withSpring(1));
    }
    onPress(node);
  };

  const ring = done
    ? [styles.ring, layout.ringDone]
    : [styles.ring, ringColor ? { borderColor: ringColor } : styles.ringNone, locked ? layout.ringLocked : null];
  const a11yStatus = done ? t('path.done') : chip?.label;
  const core = [
    layout.core,
    { backgroundColor: locked ? conditionColors.seasonalLock.node : type.color },
    variant === 'notNow' ? layout.coreFaded : null,
  ];

  return (
    <>
      <Animated.View style={[layout.ringBox, { left: x - half, top: y - half }, bounceStyle]}>
        <Pressable
          testID={`path.node.${n}`}
          accessibilityLabel={a11yStatus ? `${name}, ${a11yStatus}` : name}
          feedback="none"
          onPress={press}
          style={ring}
        >
          {done ? (
            <DoneCore />
          ) : (
            <View style={core}>
              {locked ? <Padlock /> : <TypeGlyph glyph={type.glyph} color={palette.white} size={nodeSize.glyph} />}
            </View>
          )}
          {variant && variant !== 'seasonalLock' ? <Badge status={variant} /> : null}
        </Pressable>
        {flips > 0 ? <CoinShower key={flips} testID={`path.node.${n}.coins`} /> : null}
      </Animated.View>
      <View
        style={[
          layout.label,
          { top: y - half + nodeSize.labelTop },
          labelRight
            ? { left: x + half + nodeSize.labelGap }
            : { left: x - half - nodeSize.labelGap - nodeSize.labelWidth, alignItems: 'flex-end' },
        ]}
      >
        <AppText variant="h3" numberOfLines={2} style={labelRight ? null : layout.textEnd}>
          {name}
        </AppText>
        {done ? <DoneChip testID={`path.node.${n}.done`} /> : null}
        {!done && chip ? (
          <StatusChip testID={`path.node.${n}.status`} variant={chip.variant} label={chip.label} />
        ) : null}
        {variant === 'notNow' ? <WorriedMascot testID={`path.node.${n}.mascot`} /> : null}
      </View>
    </>
  );
}

const layout = StyleSheet.create({
  ringBox: { position: 'absolute', width: nodeSize.ring, height: nodeSize.ring },
  ringLocked: { borderStyle: 'dashed', borderWidth: nodeSize.lockBorder },
  core: {
    width: nodeSize.core,
    height: nodeSize.core,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor,
    shadowOffset: { width: 0, height: elevation.node.offsetY },
    shadowOpacity: elevation.node.opacity,
    shadowRadius: elevation.node.radius,
    elevation: elevation.node.androidElevation,
  },
  coreFaded: { opacity: nodeSize.notNowCoreOpacity },
  ringDone: { width: doneSize.ring, height: doneSize.ring, borderWidth: 0 },
  doneBox: { width: doneSize.core, height: doneSize.core + doneSize.edge },
  doneDisc: {
    position: 'absolute',
    left: 0,
    width: doneSize.core,
    height: doneSize.core,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneEdge: { top: doneSize.edge, backgroundColor: pathColors.doneEdge },
  doneCore: { top: 0, backgroundColor: pathColors.done },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[4],
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
  },
  label: { position: 'absolute', width: nodeSize.labelWidth, gap: spacing[6] },
  textEnd: { textAlign: 'right' },
});

const useStyles = createThemedStyles(c => ({
  ring: {
    width: nodeSize.ring,
    height: nodeSize.ring,
    borderRadius: radii.pill,
    borderWidth: nodeSize.ringBorder,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNone: { borderColor: c.line },
  badge: {
    position: 'absolute',
    right: nodeSize.badgeInset,
    bottom: nodeSize.badgeInset,
    width: nodeSize.badge,
    height: nodeSize.badge,
    borderRadius: radii.pill,
    borderWidth: nodeSize.badgeBorder,
    borderColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
