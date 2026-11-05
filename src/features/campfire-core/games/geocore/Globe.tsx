import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path as SvgPath } from 'react-native-svg';
import {
  Canvas,
  Circle,
  Path,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import { scheduleOnRN } from 'react-native-worklets';

import { Pressable } from '../../../../shared/components/Pressable';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { getLocale, t } from '../../../../shared/i18n';
import type { LatLng } from '../../../../shared/utils/geo';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, geoColors, geoSizes } from '../../campTheme';
import { countryByIso, microstates } from './geoData';
import {
  fillRings,
  invertScreen,
  makeFrame,
  nearestDot,
  placeDots,
  strokeLines,
  type Frame,
  type SphereLines,
} from './globeFrame';
import {
  borderLines,
  graticuleLines,
  landLines,
  microDots,
  ringsOf,
  type RingRange,
} from './globeGeometry';
import {
  baseRadius,
  clampLat,
  clampZoom,
  countryAt,
  initialView,
  wrapLng,
} from './globeProjection';
import { AnswerMark, MyPin, SeatPin, type GlobeState } from './GlobeMarkers';

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
  /** Animates the rotation to centre this point (at mount: starts there). */
  focus?: LatLng | null;
  /** With focus, e.g. 4. */
  focusZoom?: number;
  /** Read-only: taps are ignored, rotate and zoom still work. */
  disabled?: boolean;
  onSelectCountry?: (iso: string, at: LatLng) => void;
  onDropPin?: (at: LatLng) => void;
  testID?: string;
};

/**
 * The page's scroll gesture (`Gesture.Native()` around its ScrollView). Globe drags block it, so a
 * vertical drag on the globe rotates the globe and never scrolls the page.
 */
export const GlobeScrollContext = createContext<GestureType | null>(null);

const countryName = (iso: string) =>
  countryByIso(iso)?.name[getLocale()] ?? iso;

const { pathMinStep, microGap, microHit } = geoSizes;

/** The frame for the current shared values (UI thread). */
function frameOf(globe: GlobeState): Frame {
  'worklet';
  const box = globe.size.value;
  return makeFrame(
    globe.lambda.value,
    globe.phi.value,
    baseRadius(box) * globe.zoom.value,
    box,
  );
}

/** A path rebuilt on the UI thread whenever the frame (rotation, zoom or size) changes. */
function useFillPath(frame: SharedValue<Frame>, lines: SphereLines, rings: RingRange) {
  const { from, to } = rings;
  return useDerivedValue<SkPath>(() => {
    const builder = Skia.PathBuilder.Make();
    fillRings(builder, lines, from, to, frame.value, pathMinStep);
    return builder.detach();
  });
}

function useStrokePath(frame: SharedValue<Frame>, lines: SphereLines) {
  return useDerivedValue<SkPath>(() => {
    const builder = Skia.PathBuilder.Make();
    strokeLines(builder, lines, frame.value, pathMinStep);
    return builder.detach();
  });
}

const allLand: RingRange = { from: 0, to: landLines.starts.length - 1 };

function startView(focus: LatLng | null | undefined, focusZoom?: number) {
  return focus
    ? {
        lng: wrapLng(focus.lng),
        lat: clampLat(focus.lat),
        zoom: clampZoom(focusZoom ?? geoSizes.minZoom),
      }
    : initialView;
}

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
  const scrollGesture = useContext(GlobeScrollContext);
  const [start] = useState(() => startView(focus, focusZoom));
  /* Shown to screen readers; updated when a zoom ends, never during a gesture. */
  const [zoomLabel, setZoomLabel] = useState(start.zoom);

  const lambda = useSharedValue(start.lng);
  const phi = useSharedValue(start.lat);
  const zoom = useSharedValue(start.zoom);
  const size = useSharedValue<number>(geoSizes.board);
  const pinchFrom = useSharedValue(start.zoom);
  const globe = useMemo<GlobeState>(
    () => ({ lambda, phi, zoom, size }),
    [lambda, phi, zoom, size],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0) {
        size.value = width;
      }
    },
    [size],
  );

  /* Focus: the shared values animate on the UI thread, the shorter way round in longitude. */
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
    const to = startView({ lat: focusLat, lng: focusLng }, focusZoom);
    const timing = {
      duration: reducedMotion ? 0 : geoSizes.focusMs,
      easing: Easing.inOut(Easing.cubic),
    };
    lambda.value = withTiming(
      lambda.value + wrapLng(to.lng - lambda.value),
      timing,
    );
    phi.value = withTiming(to.lat, timing);
    zoom.value = withTiming(to.zoom, timing);
    setZoomLabel(to.zoom);
  }, [focusLat, focusLng, focusZoom, lambda, phi, zoom, reducedMotion]);

  const zoomBy = useCallback(
    (factor: number) => {
      cancelAnimation(zoom);
      const next = clampZoom(zoom.value * factor);
      zoom.value = next;
      setZoomLabel(next);
    },
    [zoom],
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

  const onMicroAt = useCallback(
    (index: number) => {
      const item = microstates[index];
      if (item) {
        choose(item.iso, { lat: item.lat, lng: item.lng });
      }
    },
    [choose],
  );

  const onTapAt = useCallback(
    (lat: number, lng: number) => {
      if (disabled) {
        return;
      }
      const at = { lat, lng };
      choose(mode === 'country' ? countryAt(at) : null, at);
    },
    [choose, disabled, mode],
  );

  /* Microstate dots are country answers: drawn and tappable in the country games only. */
  const dotsShown = mode === 'country';

  const gesture = useMemo(() => {
    const stop = () => {
      'worklet';
      cancelAnimation(lambda);
      cancelAnimation(phi);
      cancelAnimation(zoom);
    };
    /* Worklets on the UI thread: a drag writes the shared values only, no React render. */
    const pan = Gesture.Pan()
      .onBegin(stop)
      .onChange(event => {
        const k = 180 / (Math.PI * baseRadius(size.value) * zoom.value);
        lambda.value -= event.changeX * k;
        phi.value = clampLat(phi.value + event.changeY * k);
      })
      .withTestId(`${testID}.pan`);
    const pinch = Gesture.Pinch()
      .onBegin(stop)
      .onStart(() => {
        pinchFrom.value = zoom.value;
      })
      .onUpdate(event => {
        zoom.value = clampZoom(pinchFrom.value * event.scale);
      })
      .onEnd(() => {
        scheduleOnRN(setZoomLabel, zoom.value);
      })
      .withTestId(`${testID}.pinch`);
    if (scrollGesture) {
      pan.blocksExternalGesture(scrollGesture);
      pinch.blocksExternalGesture(scrollGesture);
    }
    const tap = Gesture.Tap()
      .maxDistance(geoSizes.tapSlop)
      .onEnd((event, success) => {
        if (!success) {
          return;
        }
        const f = frameOf(globe);
        /* A visible microstate dot within reach wins over the country under the finger. */
        if (dotsShown) {
          const hit = nearestDot(
            placeDots(f, size.value, microDots, microGap),
            event.x,
            event.y,
            microHit,
          );
          if (hit >= 0) {
            scheduleOnRN(onMicroAt, hit);
            return;
          }
        }
        const at = invertScreen(f, event.x, event.y);
        if (at) {
          scheduleOnRN(onTapAt, at.lat, at.lng);
        }
      })
      .withTestId(`${testID}.tap`);
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [
    dotsShown,
    globe,
    lambda,
    onMicroAt,
    onTapAt,
    phi,
    pinchFrom,
    scrollGesture,
    size,
    testID,
    zoom,
  ]);

  /* The one frame per UI frame: every path, dot and marker is projected from it. */
  const frame = useDerivedValue(() => frameOf(globe));
  const radius = useDerivedValue(() => frame.value.r);
  const centre = useDerivedValue(() => frame.value.cx);
  const graticule = useStrokePath(frame, graticuleLines);
  const land = useFillPath(frame, landLines, allLand);
  const borders = useStrokePath(frame, borderLines);
  const selectedShown = mode === 'country' && Boolean(selectedIso);
  const selected = useFillPath(
    frame,
    landLines,
    ringsOf(selectedShown ? selectedIso : null),
  );
  const answerShape = useFillPath(frame, landLines, ringsOf(answer?.iso));
  const dots = useDerivedValue<SkPath>(() => {
    const builder = Skia.PathBuilder.Make();
    if (dotsShown) {
      const placed = placeDots(frame.value, size.value, microDots, microGap);
      for (let k = 0; k < placed.length; k++) {
        const dot = placed[k];
        if (dot) {
          builder.addCircle(dot.x, dot.y, geoSizes.microDot / 2);
        }
      }
    }
    return builder.detach();
  });

  /* Screen readers hear that a country is selected, never which one. */
  useEffect(() => {
    if (selectedShown) {
      AccessibilityInfo.announceForAccessibility(t('camp.geo.globe.selected'));
    }
  }, [selectedShown, selectedIso]);

  return (
    <View style={styles.box} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          testID={testID}
          accessible
          accessibilityLabel={t('camp.geo.globe.label')}
          accessibilityHint={t('camp.geo.globe.hint')}
          accessibilityValue={{
            min: geoSizes.minZoom,
            max: geoSizes.maxZoom,
            now: Math.round(zoomLabel * 10) / 10,
            ...(selectedShown ? { text: t('camp.geo.globe.selected') } : {}),
          }}
          style={styles.fill}
        >
          <Canvas style={StyleSheet.absoluteFill}>
            <Circle
              cx={centre}
              cy={centre}
              r={radius}
              color={geoColors.ocean}
            />
            <Path
              path={graticule}
              style="stroke"
              strokeWidth={geoSizes.graticuleStroke}
              color={geoColors.graticule}
            />
            <Path path={land} color={geoColors.land} />
            <Path
              path={borders}
              style="stroke"
              strokeWidth={geoSizes.borderStroke}
              color={geoColors.border}
            />
            <Path path={answerShape} color={geoColors.answer} />
            <Path path={selected} color={geoColors.selected} />
            <Path
              path={selected}
              style="stroke"
              strokeWidth={geoSizes.selectedStroke}
              color={geoColors.onSelected}
            />
            <Path path={dots} color={geoColors.microDot} />
            <Path
              path={dots}
              style="stroke"
              strokeWidth={geoSizes.microRing}
              color={geoColors.microRing}
            />
            <Circle
              cx={centre}
              cy={centre}
              r={radius}
              style="stroke"
              strokeWidth={geoSizes.rimStroke}
              color={geoColors.rim}
              opacity={geoSizes.rimOpacity}
            />
          </Canvas>
          {answer?.point ? (
            <AnswerMark frame={frame} size={size} point={answer.point} />
          ) : null}
          {(pins ?? []).map(pin => (
            <SeatPin
              key={pin.seatId}
              frame={frame}
              size={size}
              seatId={pin.seatId}
              point={pin.point}
              label={pin.label}
              colorIndex={pin.colorIndex}
            />
          ))}
          {mode === 'point' && myPin ? (
            <MyPin frame={frame} size={size} point={myPin} />
          ) : null}
        </Animated.View>
      </GestureDetector>
      {dotsShown ? (
        /*
         * The dots are drawn and hit-tested in Skia; these buttons only give screen readers (and
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
          onPress={() => zoomBy(geoSizes.zoomStep)}
        />
        <ZoomButton
          testID="geo.zoom-out"
          label={t('camp.geo.globe.zoomOut')}
          glyph="M5 12h14"
          onPress={() => zoomBy(1 / geoSizes.zoomStep)}
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
    right: 0,
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
