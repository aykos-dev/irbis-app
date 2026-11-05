import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type CameraRef,
  type PressEvent,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';

import { Pressable } from '../../../../shared/components/Pressable';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { getLocale, t } from '../../../../shared/i18n';
import type { LatLng } from '../../../../shared/utils/geo';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, geoColors, geoSizes } from '../../campTheme';
import { countryByIso, microstates } from './geoData';
import {
  countryAt,
  countryShapes,
  fitZoom,
  graticule,
  isoFilter,
  mapStyle,
  maxZoomFor,
  microAt,
  microPoints,
  microShownFilter,
  wrapLng,
  zoomFor,
} from './mapGeometry';
import { AnswerMark, MyPin, SeatPin } from './MapMarkers';

export type GlobePin = {
  seatId: string;
  point: LatLng;
  label: string;
  colorIndex: number;
};

export type GlobeProps = {
  /** Tap selects a country, or drops a point. */
  mode: 'country' | 'point';
  /** Country mode: highlighted purple (never named: the player must know it). */
  selectedIso?: string | null;
  /** Point mode: the player's pin. */
  myPin?: LatLng | null;
  /** Reveal: country filled orange and/or a marker. */
  answer?: { iso?: string; point?: LatLng } | null;
  pins?: GlobePin[];
  /** Eases the map to centre this point (at mount: starts there). */
  focus?: LatLng | null;
  /** With focus, e.g. 4 (two zoom levels in) or 2 (one level). */
  focusZoom?: number;
  /** Read-only: taps are ignored, pan and zoom still work. */
  disabled?: boolean;
  onSelectCountry?: (iso: string, at: LatLng) => void;
  onDropPin?: (at: LatLng) => void;
  testID?: string;
};

/**
 * Set by a scrolling page around the map: called with true while a finger is on the map, so the
 * page stops scrolling and a drag on the map only ever moves the map.
 */
export const GlobeScrollContext = createContext<
  ((touched: boolean) => void) | null
>(null);

const countryName = (iso: string) =>
  countryByIso(iso)?.name[getLocale()] ?? iso;

const { microDot, microRing, focusMs } = geoSizes;

const roundZoom = (zoom: number) => Math.round(zoom * 10) / 10;

type StartView = { center: [number, number]; zoom: number };

function viewFor(
  minZoom: number,
  focus: LatLng | null | undefined,
  focusZoom?: number,
): StartView {
  const maxZoom = maxZoomFor(minZoom);
  return focus
    ? {
        center: [wrapLng(focus.lng), focus.lat],
        zoom: Math.min(maxZoom, zoomFor(minZoom, focusZoom)),
      }
    : { center: [geoSizes.initialLng, geoSizes.initialLat], zoom: minZoom };
}

/**
 * The geocore map (MapLibre, flat Web Mercator, fully offline): bundled countries, graticule and
 * microstate dots, RN-view markers. The name stays `Globe` for its callers.
 */
export function Globe({
  mode,
  selectedIso,
  myPin,
  answer,
  pins,
  focus,
  focusZoom,
  disabled = false,
  onSelectCountry,
  onDropPin,
  testID = 'geo.globe',
}: GlobeProps) {
  const reducedMotion = useReducedMotion();
  const setScrollLock = useContext(GlobeScrollContext);
  const camera = useRef<CameraRef>(null);
  const [minZoom, setMinZoom] = useState(() => fitZoom(geoSizes.board));
  const maxZoom = maxZoomFor(minZoom);
  const [start] = useState(() => viewFor(minZoom, focus, focusZoom));
  /* The live zoom (taps and buttons read it); the label follows when a move ends. */
  const zoom = useRef(start.zoom);
  const [zoomLabel, setZoomLabel] = useState(start.zoom);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setMinZoom(fitZoom(width));
    }
  }, []);

  /* Focus changes after mount ease the camera there. */
  const focusLat = focus?.lat;
  const focusLng = focus?.lng;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (focusLat === undefined || focusLng === undefined) {
      return;
    }
    const to = viewFor(minZoom, { lat: focusLat, lng: focusLng }, focusZoom);
    camera.current?.easeTo({
      center: to.center,
      zoom: to.zoom,
      duration: reducedMotion ? 0 : focusMs,
    });
    zoom.current = to.zoom;
    setZoomLabel(to.zoom);
  }, [focusLat, focusLng, focusZoom, minZoom, reducedMotion]);

  const zoomBy = useCallback(
    (delta: number) => {
      const next = Math.min(maxZoom, Math.max(minZoom, zoom.current + delta));
      camera.current?.zoomTo(next, {
        duration: reducedMotion ? 0 : focusMs,
      });
      zoom.current = next;
      setZoomLabel(next);
    },
    [maxZoom, minZoom, reducedMotion],
  );

  const onRegion = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      zoom.current = event.nativeEvent.zoom;
    },
    [],
  );
  const onRegionDone = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      zoom.current = event.nativeEvent.zoom;
      setZoomLabel(event.nativeEvent.zoom);
    },
    [],
  );

  const choose = useCallback(
    (iso: string | null, at: LatLng) => {
      if (disabled) {
        return;
      }
      if (mode === 'point') {
        haptics.tap();
        onDropPin?.(at);
      } else if (iso) {
        haptics.tap();
        onSelectCountry?.(iso, at);
      }
    },
    [disabled, mode, onDropPin, onSelectCountry],
  );

  /* Microstate dots are country answers: drawn and tappable in the country games only. */
  const dotsShown = mode === 'country';

  const onPress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      if (disabled) {
        return;
      }
      const [lng, lat] = event.nativeEvent.lngLat;
      const at = { lat, lng: wrapLng(lng) };
      if (mode === 'point') {
        choose(null, at);
        return;
      }
      /* A visible microstate dot within reach wins over the country under the finger. */
      const dot = dotsShown ? microAt(at, zoom.current) : null;
      if (dot) {
        choose(dot.iso, dot.at);
        return;
      }
      choose(countryAt(at), at);
    },
    [choose, disabled, dotsShown, mode],
  );

  const selectedShown = mode === 'country' && Boolean(selectedIso);

  /* Screen readers hear that a country is selected, never which one. */
  useEffect(() => {
    if (selectedShown) {
      AccessibilityInfo.announceForAccessibility(t('camp.geo.globe.selected'));
    }
  }, [selectedShown, selectedIso]);

  const lock = useCallback(() => setScrollLock?.(true), [setScrollLock]);
  const unlock = useCallback(() => setScrollLock?.(false), [setScrollLock]);
  useEffect(() => unlock, [unlock]);

  return (
    <View
      style={styles.box}
      onLayout={onLayout}
      onTouchStart={lock}
      onTouchEnd={unlock}
      onTouchCancel={unlock}
    >
      <View
        testID={testID}
        accessible
        accessibilityLabel={t('camp.geo.globe.label')}
        accessibilityHint={t('camp.geo.globe.hint')}
        accessibilityValue={{
          min: roundZoom(minZoom),
          max: roundZoom(maxZoom),
          now: roundZoom(zoomLabel),
          ...(selectedShown ? { text: t('camp.geo.globe.selected') } : {}),
        }}
        style={styles.fill}
      >
        <MapLibreMap
          testID={`${testID}.map`}
          style={styles.fill}
          mapStyle={mapStyle}
          logo={false}
          compass={false}
          attribution={false}
          scaleBar={false}
          touchRotate={false}
          touchPitch={false}
          onPress={onPress}
          onRegionIsChanging={onRegion}
          onRegionDidChange={onRegionDone}
        >
          <Camera
            ref={camera}
            initialViewState={{ center: start.center, zoom: start.zoom }}
            minZoom={minZoom}
            maxZoom={maxZoom}
          />
          <GeoJSONSource id="geo-graticule" data={graticule}>
            <Layer
              id="geo-graticule-lines"
              type="line"
              style={{
                lineColor: geoColors.graticule,
                lineWidth: geoSizes.graticuleStroke,
              }}
            />
          </GeoJSONSource>
          <GeoJSONSource id="geo-countries" data={countryShapes}>
            <Layer
              id="geo-land"
              type="fill"
              style={{ fillColor: geoColors.land }}
            />
            <Layer
              id="geo-answer"
              type="fill"
              filter={isoFilter(answer?.iso)}
              style={{ fillColor: geoColors.answer }}
            />
            <Layer
              id="geo-selected"
              type="fill"
              filter={isoFilter(selectedShown ? selectedIso : null)}
              style={{ fillColor: geoColors.selected }}
            />
            <Layer
              id="geo-borders"
              type="line"
              style={{
                lineColor: geoColors.border,
                lineWidth: geoSizes.borderStroke,
              }}
            />
            <Layer
              id="geo-selected-edge"
              type="line"
              filter={isoFilter(selectedShown ? selectedIso : null)}
              style={{
                lineColor: geoColors.onSelected,
                lineWidth: geoSizes.selectedStroke,
              }}
            />
          </GeoJSONSource>
          {dotsShown ? (
            <GeoJSONSource id="geo-micro" data={microPoints}>
              <Layer
                id="geo-micro-dots"
                type="circle"
                filter={microShownFilter}
                style={{
                  circleRadius: microDot / 2,
                  circleColor: geoColors.microDot,
                  circleStrokeWidth: microRing,
                  circleStrokeColor: geoColors.microRing,
                }}
              />
            </GeoJSONSource>
          ) : null}
          {answer?.point ? <AnswerMark point={answer.point} /> : null}
          {(pins ?? []).map(pin => (
            <SeatPin
              key={pin.seatId}
              seatId={pin.seatId}
              point={pin.point}
              label={pin.label}
              colorIndex={pin.colorIndex}
            />
          ))}
          {mode === 'point' && myPin ? <MyPin point={myPin} /> : null}
        </MapLibreMap>
      </View>
      {dotsShown ? (
        /*
         * The dots are drawn and hit-tested on the map; these buttons only give screen readers (and
         * tests) a way to pick a microstate. Clipped to 1 pt: invisible and untouchable by eye.
         */
        <View style={styles.a11yList}>
          {microstates.map(item => (
            <Pressable
              key={item.iso}
              testID={`geo.micro.${item.iso}`}
              accessibilityLabel={countryName(item.iso)}
              disabled={disabled}
              onPress={() => choose(item.iso, { lat: item.lat, lng: item.lng })}
              style={styles.a11yButton}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.zoom}>
        <ZoomButton
          testID="geo.zoom-in"
          label={t('camp.geo.globe.zoomIn')}
          glyph="M12 5v14M5 12h14"
          onPress={() => zoomBy(1)}
        />
        <ZoomButton
          testID="geo.zoom-out"
          label={t('camp.geo.globe.zoomOut')}
          glyph="M5 12h14"
          onPress={() => zoomBy(-1)}
        />
      </View>
    </View>
  );
}

function ZoomButton({
  testID,
  label,
  glyph,
  onPress,
}: {
  testID: string;
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.zoomButton}
    >
      <Svg
        viewBox="0 0 24 24"
        width={geoSizes.zoomGlyph}
        height={geoSizes.zoomGlyph}
      >
        <SvgPath
          d={glyph}
          fill="none"
          stroke={campColors.ink}
          strokeWidth={geoSizes.zoomStroke}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    maxWidth: geoSizes.board,
    aspectRatio: 1,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: radii.input,
    backgroundColor: geoColors.ocean,
  },
  fill: { flex: 1 },
  a11yList: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: geoSizes.a11yClip,
    height: geoSizes.a11yClip,
    overflow: 'hidden',
  },
  a11yButton: { width: geoSizes.microHit, height: geoSizes.microHit },
  zoom: {
    position: 'absolute',
    right: spacing[6],
    bottom: spacing[6],
    gap: spacing[8],
  },
  zoomButton: {
    width: geoSizes.zoomButton,
    height: geoSizes.zoomButton,
    borderRadius: radii.input,
    borderWidth: geoSizes.zoomBorder,
    borderBottomWidth: geoSizes.zoomEdge,
    borderColor: campColors.line,
    backgroundColor: campColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
