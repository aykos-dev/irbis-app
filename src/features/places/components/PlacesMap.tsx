import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  type CameraRef,
  type Expression,
  type FilterSpecification,
  type GeoJSONSourceProps,
  type GeoJSONSourceRef,
  type PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import { memo, useMemo, useRef } from 'react';
import { StyleSheet, type NativeSyntheticEvent } from 'react-native';

import { pinGlyphs } from '../../../assets/images/pins';
import type { PlaceListItemDto, PlaceType } from '../../../shared/api/generated/model';
import { palette } from '../../../shared/constants/colors';
import { appConfig } from '../../../shared/constants/config';
import { borders, motion } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { placeTypes } from '../placeTypes';

export type MapCamera = { lat: number; lng: number; zoom: number };

type Props = {
  places: PlaceListItemDto[];
  view: MapCamera;
  onOpenPlace: (place: PlaceListItemDto) => void;
};

/** Pin and cluster sizes in map points (map artwork, not layout). */
const PIN_RADIUS = 15;
const CLUSTER_RADII = [18, 22, 28] as const;
const CLUSTER_STEPS = [10, 50] as const;
const CLUSTER_TEXT = 14;
/** Glyph font of the OpenFreeMap styles (`MAP_STYLE_URL` default). */
const LABEL_FONT = ['Noto Sans Bold'];

const glyphImages = Object.fromEntries(
  Object.entries(pinGlyphs).map(([type, source]) => [`pin-${type}`, source]),
);

const typeColor: Expression = [
  'match',
  ['get', 'type'],
  ...Object.entries(placeTypes).flatMap(([type, info]) => [type, info.color]),
  palette.stone,
];

const isCluster: FilterSpecification = ['has', 'point_count'];
const isPin: FilterSpecification = ['!', ['has', 'point_count']];

type PinProperties = { id: string; type: PlaceType };

function toFeatures(places: PlaceListItemDto[]): GeoJSONSourceProps['data'] {
  return {
    type: 'FeatureCollection',
    features: places.map(place => ({
      type: 'Feature',
      id: place.id,
      properties: { id: place.id, type: place.type } satisfies PinProperties,
      geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
    })),
  };
}

/**
 * Full-screen MapLibre map (AC4): one clustered GeoJSON source from the list query. Clusters show
 * their count and zoom in on tap; single pins are type-coloured circles with the type glyph and
 * open the place.
 */
export const PlacesMap = memo(function PlacesMap({ places, view, onOpenPlace }: Props) {
  const camera = useRef<CameraRef>(null);
  const source = useRef<GeoJSONSourceRef>(null);
  const data = useMemo(() => toFeatures(places), [places]);

  const onPress = async (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = event.nativeEvent.features[0];
    if (!feature || feature.geometry.type !== 'Point') {
      return;
    }
    const [lng, lat] = feature.geometry.coordinates;
    const clusterId = feature.properties?.cluster_id;
    if (typeof clusterId === 'number' && lng !== undefined && lat !== undefined) {
      const zoom = await source.current?.getClusterExpansionZoom(clusterId);
      if (zoom !== undefined) {
        camera.current?.easeTo({ center: [lng, lat], zoom, duration: motion.layout });
      }
      return;
    }
    const place = places.find(item => item.id === feature.properties?.id);
    if (place) {
      onOpenPlace(place);
    }
  };

  return (
    <MapLibreMap
      testID="explore.map"
      style={StyleSheet.absoluteFill}
      mapStyle={appConfig.mapStyleUrl}
      logo={false}
      compass={false}
      accessibilityLabel={t('places.explore.map')}
    >
      <Camera ref={camera} center={[view.lng, view.lat]} zoom={view.zoom} duration={motion.layout} />
      <Images images={glyphImages} />
      <GeoJSONSource
        id="places"
        ref={source}
        data={data}
        cluster
        onPress={event => void onPress(event)}
      >
        <Layer
          id="places-clusters"
          type="circle"
          filter={isCluster}
          style={{
            circleColor: palette.teal,
            circleRadius: [
              'step',
              ['get', 'point_count'],
              CLUSTER_RADII[0],
              CLUSTER_STEPS[0],
              CLUSTER_RADII[1],
              CLUSTER_STEPS[1],
              CLUSTER_RADII[2],
            ],
            circleStrokeWidth: borders.card,
            circleStrokeColor: palette.white,
          }}
        />
        <Layer
          id="places-cluster-count"
          type="symbol"
          filter={isCluster}
          style={{
            textField: ['get', 'point_count_abbreviated'],
            textFont: LABEL_FONT,
            textSize: CLUSTER_TEXT,
            textColor: palette.white,
            textAllowOverlap: true,
          }}
        />
        <Layer
          id="places-pins"
          type="circle"
          filter={isPin}
          style={{
            circleColor: typeColor,
            circleRadius: PIN_RADIUS,
            circleStrokeWidth: borders.card,
            circleStrokeColor: palette.white,
          }}
        />
        <Layer
          id="places-pin-glyphs"
          type="symbol"
          filter={isPin}
          style={{
            iconImage: ['concat', 'pin-', ['get', 'type']],
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
          }}
        />
      </GeoJSONSource>
    </MapLibreMap>
  );
});
