import { StyleSheet, View } from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { Icon } from '../../../../shared/components/Icon';
import { radii, spacing } from '../../../../shared/constants/spacing';
import type { LatLng } from '../../../../shared/utils/geo';
import { geoColors, geoSeatColors, geoSizes } from '../../campTheme';
import { wrapLng } from './mapGeometry';

/** Teardrop artwork (canvas GeoRoundCity), tip at (12, 31) in a 24 × 32 box. */
const TEARDROP =
  'M12 1C6 1 1.5 5.4 1.5 11.2 1.5 19 12 31 12 31s10.5-12 10.5-19.8C22.5 5.4 18 1 12 1z';

const lngLatOf = (point: LatLng): [number, number] => [wrapLng(point.lng), point.lat];

/** The player's own pin (an RN view on the map); its tip sits on the point. */
export function MyPin({ point }: { point: LatLng }) {
  return (
    <Marker id="geo-my-pin" lngLat={lngLatOf(point)} anchor="bottom">
      <View testID="geo.my-pin" style={styles.teardrop} pointerEvents="none">
        <Svg viewBox="0 0 24 32" width="100%" height="100%">
          <Path
            d={TEARDROP}
            fill={geoColors.pinFill}
            stroke={geoColors.pinStroke}
            strokeWidth={geoSizes.pinStroke}
          />
        </Svg>
      </View>
    </Marker>
  );
}

/**
 * A reveal pin: seat-coloured dot with a dark label chip ("145 km", "You") to its right. A hidden
 * copy of the chip on the left keeps the dot at the marker's centre, whatever the label's width.
 */
export function SeatPin({
  seatId,
  point,
  label,
  colorIndex,
}: {
  seatId: string;
  point: LatLng;
  label: string;
  colorIndex: number;
}) {
  const color =
    geoSeatColors[
      ((colorIndex % geoSeatColors.length) + geoSeatColors.length) %
        geoSeatColors.length
    ];
  const chip = (
    <View style={styles.label}>
      <AppText variant="caption" style={styles.labelText} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
  return (
    <Marker id={`geo-pin-${seatId}`} lngLat={lngLatOf(point)} anchor="center">
      <View style={styles.seatRow} pointerEvents="none">
        <View
          style={styles.spacer}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {chip}
        </View>
        <View
          testID={`geo.pin.${seatId}`}
          accessible
          accessibilityLabel={label}
          style={styles.seatRow}
        >
          <View style={[styles.seatDot, { backgroundColor: color }]} />
          {chip}
        </View>
      </View>
    </Marker>
  );
}

/** The correct point at reveal. */
export function AnswerMark({ point }: { point: LatLng }) {
  return (
    <Marker id="geo-answer" lngLat={lngLatOf(point)} anchor="center">
      <View testID="geo.answer" pointerEvents="none">
        <Icon name="star" color={geoColors.answer} size={geoSizes.answerStar} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  teardrop: { width: geoSizes.pinWidth, height: geoSizes.pinHeight },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  spacer: { opacity: 0 },
  seatDot: {
    width: geoSizes.markerDot,
    height: geoSizes.markerDot,
    borderRadius: radii.pill,
    borderWidth: geoSizes.markerBorder,
    borderColor: geoColors.markerEdge,
  },
  label: {
    paddingHorizontal: spacing[6],
    borderRadius: geoSizes.chipRadius,
    backgroundColor: geoColors.labelChip,
    opacity: geoSizes.labelOpacity,
  },
  labelText: { color: geoColors.labelText },
});
