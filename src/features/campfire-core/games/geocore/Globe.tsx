import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Pressable } from '../../../../shared/components/Pressable';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { getLocale, t } from '../../../../shared/i18n';
import type { LatLng } from '../../../../shared/utils/geo';
import { haptics } from '../../../../shared/utils/haptics';
import { campColors, geoColors, geoSizes } from '../../campTheme';
import { countryByIso, microstates } from './geoData';
import {
  buildPaths,
  clampLat,
  clampZoom,
  countryAt,
  countryPath,
  initialView,
  invertPoint,
  projectPoint,
  rotateBy,
  wrapLng,
  type GlobeView,
  type ScreenPoint,
} from './globeProjection';
import {
  AnswerMark,
  MicroButton,
  MyPin,
  SeatPin,
  SelectedChip,
} from './GlobeMarkers';

export type GlobePin = {
  seatId: string;
  point: LatLng;
  label: string;
  colorIndex: number;
};

export type GlobeProps = {
  /** Tap selects a country, or drops a point. */
  mode: 'country' | 'point';
  /** Country mode: highlighted purple with a name chip. */
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

const countryName = (iso: string) =>
  countryByIso(iso)?.name[getLocale()] ?? iso;

const viewFor = (focus: LatLng, zoom: number | undefined): GlobeView => ({
  lng: wrapLng(focus.lng),
  lat: clampLat(focus.lat),
  zoom: clampZoom(zoom ?? geoSizes.minZoom),
});

/** Frame limiter: at most `fps` updates per second, the last one always lands. */
function useThrottle(fps: number) {
  const last = useRef(0);
  return useCallback(
    (run: () => void, force = false) => {
      const now = Date.now();
      if (force || now - last.current >= 1000 / fps) {
        last.current = now;
        run();
      }
    },
    [fps],
  );
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
  const [size, setSize] = useState<number>(geoSizes.board);
  const [view, setView] = useState<GlobeView>(() =>
    focus ? viewFor(focus, focusZoom) : initialView,
  );
  /** The live view during gestures and the focus animation; `view` follows it, throttled. */
  const live = useRef(view);
  const commit = useCallback((next: GlobeView) => {
    live.current = next;
    setView(next);
  }, []);
  const dragFrame = useThrottle(geoSizes.dragFps);
  const focusFrame = useThrottle(geoSizes.focusFps);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setSize(width);
    }
  }, []);

  /* Pinch: a cheap scale on the wrapper while active; the real zoom is rebuilt on end. */
  const pinchScale = useSharedValue(1);
  const pinchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pinchScale.value }],
  }));

  /* Focus: Reanimated drives the progress, the projection follows on the JS thread. */
  const focusFrom = useRef(view);
  const focusTo = useRef(view);
  const progress = useSharedValue(1);
  const applyFocus = useCallback(
    (p: number) => {
      const from = focusFrom.current;
      const to = focusTo.current;
      const next = {
        lng: wrapLng(from.lng + wrapLng(to.lng - from.lng) * p),
        lat: clampLat(from.lat + (to.lat - from.lat) * p),
        zoom: clampZoom(from.zoom + (to.zoom - from.zoom) * p),
      };
      focusFrame(() => commit(next), p >= 1);
    },
    [commit, focusFrame],
  );
  useAnimatedReaction(
    () => progress.value,
    (p, previous) => {
      if (previous !== null && p !== previous) {
        scheduleOnRN(applyFocus, p);
      }
    },
  );
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
    focusFrom.current = live.current;
    focusTo.current = viewFor({ lat: focusLat, lng: focusLng }, focusZoom);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reducedMotion ? 0 : geoSizes.focusMs,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [focusLat, focusLng, focusZoom, progress, reducedMotion]);

  const zoomBy = useCallback(
    (factor: number) => {
      const current = live.current;
      commit({ ...current, zoom: clampZoom(current.zoom * factor) });
    },
    [commit],
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

  const onTap = useCallback(
    (touch: ScreenPoint) => {
      if (disabled) {
        return;
      }
      const at = invertPoint(size, live.current, touch);
      if (at) {
        choose(mode === 'country' ? countryAt(at) : null, at);
      }
    },
    [choose, disabled, mode, size],
  );

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .runOnJS(true)
      .onChange(event => {
        live.current = rotateBy(
          live.current,
          event.changeX,
          event.changeY,
          size,
        );
        dragFrame(() => setView(live.current));
      })
      .onFinalize(() => setView(live.current))
      .withTestId(`${testID}.pan`);
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onUpdate(event => {
        const zoom = live.current.zoom;
        pinchScale.value = clampZoom(zoom * event.scale) / zoom;
      })
      .onFinalize(() => {
        const current = live.current;
        const scale = pinchScale.value;
        pinchScale.value = 1;
        commit({ ...current, zoom: clampZoom(current.zoom * scale) });
      })
      .withTestId(`${testID}.pinch`);
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDistance(geoSizes.tapSlop)
      .onEnd((event, success) => {
        if (success) {
          onTap({ x: event.x, y: event.y });
        }
      })
      .withTestId(`${testID}.tap`);
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);
  }, [commit, dragFrame, onTap, pinchScale, size, testID]);

  /* Paths are rebuilt per (rotation, zoom, size) only; highlights are one path each. */
  const paths = useMemo(() => buildPaths(size, view), [size, view]);
  const selectedPath = useMemo(
    () =>
      mode === 'country' && selectedIso
        ? countryPath(size, view, selectedIso)
        : '',
    [mode, selectedIso, size, view],
  );
  const answerPath = useMemo(
    () => (answer?.iso ? countryPath(size, view, answer.iso) : ''),
    [answer?.iso, size, view],
  );

  const project = (point: LatLng) => {
    const xy = projectPoint(size, view, point);
    return xy && xy.x >= 0 && xy.y >= 0 && xy.x <= size && xy.y <= size
      ? xy
      : null;
  };
  const selectedCountry =
    mode === 'country' && selectedIso ? countryByIso(selectedIso) : undefined;
  const selectedAt = selectedCountry ? project(selectedCountry) : null;
  const myPinAt = mode === 'point' && myPin ? project(myPin) : null;
  const answerAt = answer?.point ? project(answer.point) : null;
  const micro = microstates.flatMap(item => {
    const at = project(item);
    return at ? [{ item, at }] : [];
  });

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
            now: Math.round(view.zoom * 10) / 10,
          }}
          style={[styles.fill, pinchStyle]}
        >
          <Svg width={size} height={size}>
            <Path d={paths.sphere} fill={geoColors.ocean} />
            <Path
              d={paths.graticule}
              fill="none"
              stroke={geoColors.graticule}
              strokeWidth={geoSizes.graticuleStroke}
            />
            <Path
              d={paths.countries.map(country => country.d).join('')}
              fill={geoColors.land}
              stroke={geoColors.border}
              strokeWidth={geoSizes.borderStroke}
            />
            {answerPath ? (
              <Path
                d={answerPath}
                fill={geoColors.answer}
                stroke={geoColors.border}
                strokeWidth={geoSizes.borderStroke}
              />
            ) : null}
            {selectedPath ? (
              <Path
                d={selectedPath}
                fill={geoColors.selected}
                stroke={geoColors.onSelected}
                strokeWidth={geoSizes.selectedStroke}
              />
            ) : null}
            <Path
              d={paths.sphere}
              fill="none"
              stroke={geoColors.rim}
              strokeOpacity={geoSizes.rimOpacity}
              strokeWidth={geoSizes.rimStroke}
            />
          </Svg>
          {selectedAt && selectedIso ? (
            <SelectedChip point={selectedAt} name={countryName(selectedIso)} />
          ) : null}
          {answerAt ? <AnswerMark point={answerAt} /> : null}
          {(pins ?? []).map(pin => {
            const at = project(pin.point);
            return at ? (
              <SeatPin
                key={pin.seatId}
                seatId={pin.seatId}
                point={at}
                label={pin.label}
                colorIndex={pin.colorIndex}
              />
            ) : null;
          })}
          {myPinAt ? <MyPin point={myPinAt} /> : null}
        </Animated.View>
      </GestureDetector>
      {/* Outside the detector so a dot press never also lands as a globe tap. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, pinchStyle]}
        pointerEvents="box-none"
      >
        {micro.map(({ item, at }) => (
          <MicroButton
            key={item.iso}
            iso={item.iso}
            name={countryName(item.iso)}
            point={at}
            disabled={disabled}
            onPress={() => choose(item.iso, { lat: item.lat, lng: item.lng })}
          />
        ))}
      </Animated.View>
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
        <Path
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
