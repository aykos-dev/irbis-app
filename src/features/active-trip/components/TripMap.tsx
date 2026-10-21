import { Camera, GeoJSONSource, Layer, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';

import type { TripWaypointDto } from '../../../shared/api/generated/model';
import { palette } from '../../../shared/constants/colors';
import { appConfig } from '../../../shared/constants/config';
import { borders, motion } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import type { Fix } from '../trackStore';

type Props = {
  points: [number, number][];
  waypoints: TripWaypointDto[];
  last: Fix | null;
  /** Map centre until the first fix: the trip's place. */
  fallback: { lat: number; lng: number };
};

/** Map artwork sizes in map points. */
const ROUTE_WIDTH = 5;
const WAYPOINT_RADIUS = 9;
const USER_RADIUS = 8;
const CHECK_TEXT = 12;
const TRAIL_ZOOM = 14;
/** Glyph font of the OpenFreeMap styles (`MAP_STYLE_URL` default). */
const LABEL_FONT = ['Noto Sans Bold'];
const CHECK_GLYPH = '✓';

/**
 * Full-bleed trip map (AC1): the recorded route as a line, a ✓ pin per logged waypoint and the user
 * dot; the camera follows the latest fix, or shows the place before the first one.
 */
export const TripMap = memo(function TripMap({ points, waypoints, last, fallback }: Props) {
  const route = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: points },
    }),
    [points],
  );
  const pins = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: waypoints.map(waypoint => ({
        type: 'Feature' as const,
        id: waypoint.n,
        properties: { n: waypoint.n },
        geometry: { type: 'Point' as const, coordinates: [waypoint.lng, waypoint.lat] },
      })),
    }),
    [waypoints],
  );
  const centre = last ?? fallback;

  return (
    <MapLibreMap
      testID="active.map"
      style={StyleSheet.absoluteFill}
      mapStyle={appConfig.mapStyleUrl}
      logo={false}
      compass={false}
      accessibilityLabel={t('active.title')}
    >
      <Camera center={[centre.lng, centre.lat]} zoom={TRAIL_ZOOM} duration={motion.layout} />
      {points.length > 1 ? (
        <GeoJSONSource id="active-route" data={route}>
          <Layer
            id="active-route-line"
            type="line"
            style={{ lineColor: palette.teal, lineWidth: ROUTE_WIDTH, lineCap: 'round', lineJoin: 'round' }}
          />
        </GeoJSONSource>
      ) : null}
      <GeoJSONSource id="active-waypoints" data={pins}>
        <Layer
          id="active-waypoint-pins"
          type="circle"
          style={{
            circleColor: palette.pine,
            circleRadius: WAYPOINT_RADIUS,
            circleStrokeWidth: borders.card,
            circleStrokeColor: palette.white,
          }}
        />
        <Layer
          id="active-waypoint-checks"
          type="symbol"
          style={{
            textField: CHECK_GLYPH,
            textFont: LABEL_FONT,
            textSize: CHECK_TEXT,
            textColor: palette.white,
            textAllowOverlap: true,
          }}
        />
      </GeoJSONSource>
      {last ? (
        <GeoJSONSource
          id="active-user"
          data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [last.lng, last.lat] } }}
        >
          <Layer
            id="active-user-dot"
            type="circle"
            style={{
              circleColor: palette.sky,
              circleRadius: USER_RADIUS,
              circleStrokeWidth: borders.card,
              circleStrokeColor: palette.white,
            }}
          />
        </GeoJSONSource>
      ) : null}
    </MapLibreMap>
  );
});
