import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { Icon } from '../../../../shared/components/Icon';
import { Pressable } from '../../../../shared/components/Pressable';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { geoColors, geoSeatColors, geoSizes } from '../../campTheme';
import type { LatLng } from '../../../../shared/utils/geo';
import { makeFrame, projectVector, toVector } from './globeFrame';
import { baseRadius } from './globeProjection';

/** Teardrop artwork (canvas GeoRoundCity), tip at (12, 31) in a 24 × 32 box. */
const TEARDROP =
  'M12 1C6 1 1.5 5.4 1.5 11.2 1.5 19 12 31 12 31s10.5-12 10.5-19.8C22.5 5.4 18 1 12 1z';

/** The live view on the UI thread: centre (lambda, phi) in degrees, zoom, box size in pt. */
export type GlobeState = {
  lambda: SharedValue<number>;
  phi: SharedValue<number>;
  zoom: SharedValue<number>;
  size: SharedValue<number>;
};

type MarkerPlace = { globe: GlobeState; point: LatLng };

/**
 * Pins a marker to a point on the globe without React renders: a worklet projects it every frame;
 * on the far side or outside the box it is not displayed (hidden from touch and screen readers).
 */
function Projected({
  globe,
  point,
  touchable = false,
  children,
}: MarkerPlace & { touchable?: boolean; children: ReactNode }) {
  const { lambda, phi, zoom, size } = globe;
  const [x0, y0, z0] = toVector(point.lat, point.lng);
  const place = () => {
    'worklet';
    const box = size.value;
    const frame = makeFrame(
      lambda.value,
      phi.value,
      baseRadius(box) * zoom.value,
      box,
    );
    return projectVector(frame, x0, y0, z0);
  };
  const shown = useAnimatedStyle(() => {
    const p = place();
    const box = size.value;
    const inside = p.z >= 0 && p.x >= 0 && p.y >= 0 && p.x <= box && p.y <= box;
    return { display: inside ? 'flex' : 'none' };
  });
  const moved = useAnimatedStyle(() => {
    const p = place();
    return { transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  return (
    <Animated.View
      style={[styles.anchor, shown]}
      pointerEvents={touchable ? 'box-none' : 'none'}
    >
      <Animated.View
        style={[styles.anchor, moved]}
        pointerEvents={touchable ? 'box-none' : 'none'}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** The player's own pin; its tip sits on the point. */
export function MyPin(place: MarkerPlace) {
  return (
    <Projected {...place}>
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
    </Projected>
  );
}

/** A reveal pin: seat-coloured dot with a dark label chip ("145 km", "You"). */
export function SeatPin({
  seatId,
  label,
  colorIndex,
  ...place
}: MarkerPlace & {
  seatId: string;
  label: string;
  colorIndex: number;
}) {
  const color =
    geoSeatColors[
      ((colorIndex % geoSeatColors.length) + geoSeatColors.length) %
        geoSeatColors.length
    ];
  return (
    <Projected {...place}>
      <View testID={`geo.pin.${seatId}`} style={styles.anchor}>
        <View style={[styles.seatDot, { backgroundColor: color }]} />
        <View style={styles.label}>
          <AppText variant="caption" style={styles.labelText} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      </View>
    </Projected>
  );
}

/** The correct point at reveal. */
export function AnswerMark(place: MarkerPlace) {
  return (
    <Projected {...place}>
      <View testID="geo.answer" style={styles.answer}>
        <Icon name="star" color={geoColors.answer} size={geoSizes.answerStar} />
      </View>
    </Projected>
  );
}

/** The selected country's name, under its centre. */
export function SelectedChip({
  name,
  ...place
}: MarkerPlace & { name: string }) {
  return (
    <Projected {...place}>
      <View style={styles.chipRow}>
        <View testID="geo.selected" style={styles.selectedChip}>
          <AppText variant="chip" style={styles.selectedText} numberOfLines={1}>
            {name}
          </AppText>
        </View>
      </View>
    </Projected>
  );
}

/** A country too small to tap: a 44 pt button with a 14 pt dot. */
export function MicroButton({
  iso,
  name,
  disabled,
  onPress,
  ...place
}: MarkerPlace & {
  iso: string;
  name: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Projected {...place} touchable>
      <Pressable
        testID={`geo.micro.${iso}`}
        accessibilityLabel={name}
        disabled={disabled}
        onPress={onPress}
        style={styles.micro}
      >
        <View style={styles.microDot} />
      </Pressable>
    </Projected>
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
