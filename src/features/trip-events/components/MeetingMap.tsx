import { Camera, Map as MapLibreMap, Marker, type PressEvent } from '@maplibre/maplibre-react-native';
import { StyleSheet, View, type NativeSyntheticEvent } from 'react-native';

import { appConfig } from '../../../shared/constants/config';
import { borders, radii, sizes } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

export type LatLng = { lat: number; lng: number };

const ZOOM = 13;

type Props = {
  testID: string;
  center: LatLng;
  pin: LatLng | null;
  height: number;
  /** Tap to drop the pin; absent → a read-only map. */
  onPick?: (point: LatLng) => void;
};

/** Meeting point map (MapLibre): centred on the place, tap to drop the pin. No location permission needed. */
export function MeetingMap({ testID, center, pin, height, onPick }: Props) {
  const styles = useStyles();
  const onPress = (event: NativeSyntheticEvent<PressEvent>) => {
    const [lng, lat] = event.nativeEvent.lngLat;
    if (onPick && lng !== undefined && lat !== undefined) {
      onPick({ lat, lng });
    }
  };
  const focus = pin ?? center;
  return (
    <View style={[styles.frame, { height }]}>
      <MapLibreMap
        testID={testID}
        style={StyleSheet.absoluteFill}
        mapStyle={appConfig.mapStyleUrl}
        logo={false}
        compass={false}
        accessibilityLabel={t('tripEvents.meeting.map')}
        onPress={onPick ? onPress : undefined}
      >
        <Camera center={[focus.lng, focus.lat]} zoom={ZOOM} />
        {pin ? (
          <Marker id="meeting-pin" lngLat={[pin.lng, pin.lat]} anchor="center">
            <View testID={`${testID}-pin`} style={styles.pin} pointerEvents="none" />
          </Marker>
        ) : null}
      </MapLibreMap>
    </View>
  );
}

const useStyles = createThemedStyles(c => ({
  frame: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    overflow: 'hidden',
  },
  pin: {
    width: sizes.icon,
    height: sizes.icon,
    borderRadius: radii.pill,
    backgroundColor: c.orange,
    borderWidth: borders.card,
    borderColor: c.white,
  },
}));
