import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { Icon } from '../../../../shared/components/Icon';
import { Pressable } from '../../../../shared/components/Pressable';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { geoColors, geoSeatColors, geoSizes } from '../../campTheme';
import type { ScreenPoint } from './globeProjection';

/** Teardrop artwork (canvas GeoRoundCity), tip at (12, 31) in a 24 × 32 box. */
const TEARDROP =
  'M12 1C6 1 1.5 5.4 1.5 11.2 1.5 19 12 31 12 31s10.5-12 10.5-19.8C22.5 5.4 18 1 12 1z';

const at = ({ x, y }: ScreenPoint) => ({ left: x, top: y });

/** The player's own pin; its tip sits on the point. */
export function MyPin({ point }: { point: ScreenPoint }) {
  return (
    <View style={[styles.anchor, at(point)]} pointerEvents="none">
      <View testID="geo.my-pin" style={styles.teardrop}>
        <Svg viewBox="0 0 24 32" width="100%" height="100%">
          <Path
            d={TEARDROP}
            fill={geoColors.pinFill}
            stroke={geoColors.pinStroke}
            strokeWidth={geoSizes.pinStroke}
          />
        </Svg>
      </View>
      <View style={styles.pinShadow} />
    </View>
  );
}

/** A reveal pin: seat-coloured dot with a dark label chip ("145 km", "You"). */
export function SeatPin({
  seatId,
  point,
  label,
  colorIndex,
}: {
  seatId: string;
  point: ScreenPoint;
  label: string;
  colorIndex: number;
}) {
  const color =
    geoSeatColors[
      ((colorIndex % geoSeatColors.length) + geoSeatColors.length) %
        geoSeatColors.length
    ];
  return (
    <View
      testID={`geo.pin.${seatId}`}
      style={[styles.anchor, at(point)]}
      pointerEvents="none"
    >
      <View style={[styles.seatDot, { backgroundColor: color }]} />
      <View style={styles.label}>
        <AppText variant="caption" style={styles.labelText} numberOfLines={1}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

/** The correct point at reveal. */
export function AnswerMark({ point }: { point: ScreenPoint }) {
  return (
    <View style={[styles.anchor, at(point)]} pointerEvents="none">
      <View testID="geo.answer" style={styles.answer}>
        <Icon name="star" color={geoColors.answer} size={geoSizes.answerStar} />
      </View>
    </View>
  );
}

/** The selected country's name, under its centre. */
export function SelectedChip({
  point,
  name,
}: {
  point: ScreenPoint;
  name: string;
}) {
  return (
    <View style={[styles.anchor, at(point)]} pointerEvents="none">
      <View style={styles.chipRow}>
        <View testID="geo.selected" style={styles.selectedChip}>
          <AppText variant="chip" style={styles.selectedText} numberOfLines={1}>
            {name}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/** A country too small to tap: a 44 pt button with a 14 pt dot. */
export function MicroButton({
  iso,
  name,
  point,
  disabled,
  onPress,
}: {
  iso: string;
  name: string;
  point: ScreenPoint;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.anchor, at(point)]}>
      <Pressable
        testID={`geo.micro.${iso}`}
        accessibilityLabel={name}
        disabled={disabled}
        onPress={onPress}
        style={styles.micro}
      >
        <View style={styles.microDot} />
      </Pressable>
    </View>
  );
}

const half = (value: number) => value / 2;

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: 0, height: 0 },
  teardrop: {
    position: 'absolute',
    left: -half(geoSizes.pinWidth),
    top: -geoSizes.pinHeight,
    width: geoSizes.pinWidth,
    height: geoSizes.pinHeight,
  },
  pinShadow: {
    position: 'absolute',
    left: -spacing[6],
    top: -half(spacing[6]),
    width: spacing[12],
    height: spacing[6],
    borderRadius: radii.pill,
    backgroundColor: geoColors.pinShadow,
    opacity: geoSizes.pinShadowOpacity,
  },
  seatDot: {
    position: 'absolute',
    left: -half(geoSizes.markerDot),
    top: -half(geoSizes.markerDot),
    width: geoSizes.markerDot,
    height: geoSizes.markerDot,
    borderRadius: radii.pill,
    borderWidth: geoSizes.markerBorder,
    borderColor: geoColors.markerEdge,
  },
  label: {
    position: 'absolute',
    left: spacing[12],
    top: -spacing[10],
    paddingHorizontal: spacing[6],
    borderRadius: geoSizes.chipRadius,
    backgroundColor: geoColors.labelChip,
    opacity: geoSizes.labelOpacity,
  },
  labelText: { color: geoColors.labelText },
  answer: {
    position: 'absolute',
    left: -half(geoSizes.answerStar),
    top: -half(geoSizes.answerStar),
  },
  chipRow: {
    position: 'absolute',
    left: -half(geoSizes.chipRowWidth),
    top: spacing[4],
    width: geoSizes.chipRowWidth,
    alignItems: 'center',
  },
  selectedChip: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    borderRadius: geoSizes.chipRadius,
    backgroundColor: geoColors.selected,
    borderBottomWidth: geoSizes.chipEdge,
    borderBottomColor: geoColors.selectedEdge,
  },
  selectedText: { color: geoColors.onSelected },
  micro: {
    position: 'absolute',
    left: -half(geoSizes.microButton),
    top: -half(geoSizes.microButton),
    width: geoSizes.microButton,
    height: geoSizes.microButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microDot: {
    width: geoSizes.microDot,
    height: geoSizes.microDot,
    borderRadius: radii.pill,
    backgroundColor: geoColors.microDot,
    borderWidth: geoSizes.microRing,
    borderColor: geoColors.microRing,
  },
});
