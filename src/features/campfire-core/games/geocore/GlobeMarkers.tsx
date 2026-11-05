import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { Icon } from '../../../../shared/components/Icon';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { geoColors, geoSeatColors, geoSizes } from '../../campTheme';
import type { LatLng } from '../../../../shared/utils/geo';
import { projectVector, toVector, type Frame } from './globeFrame';

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

/**
 * Where a marker goes: `frame` is the one derived frame the Skia paths are drawn with, so a marker
 * and the land under it are projected from the same values in the same UI frame.
 */
type MarkerPlace = { frame: SharedValue<Frame>; size: SharedValue<number>; point: LatLng };

/**
 * Pins a marker to a point on the globe without React renders: one animated style carries both the
 * position and whether it is shown (far side or outside the box: not displayed, so hidden from touch
 * and screen readers). A single view, so the position can never lag behind a late show.
 */
function Projected({
  frame,
  size,
  point,
  children,
}: MarkerPlace & { children: ReactNode }) {
  const [x0, y0, z0] = toVector(point.lat, point.lng);
  const placed = useAnimatedStyle(() => {
    const p = projectVector(frame.value, x0, y0, z0);
    const box = size.value;
    const inside = p.z >= 0 && p.x >= 0 && p.y >= 0 && p.x <= box && p.y <= box;
    return {
      display: inside ? 'flex' : 'none',
      transform: [{ translateX: p.x }, { translateY: p.y }],
    };
  });
  return (
    <Animated.View style={[styles.anchor, placed]} pointerEvents="none">
      {children}
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

const half = (value: number) => value / 2;

const styles = StyleSheet.create({
  /* Explicit insets: the marker origin is the globe's top-left, never a flex static position. */
  anchor: { position: 'absolute', left: 0, top: 0, width: 0, height: 0 },
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
});
