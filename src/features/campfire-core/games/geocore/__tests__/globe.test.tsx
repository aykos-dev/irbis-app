import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Profiler, type ReactElement } from 'react';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { campScheme, geoSizes } from '../../../campTheme';
import { countryByIso } from '../geoData';
import { Globe } from '../Globe';
import {
  clampZoom,
  countryAt,
  initialView,
  invertPoint,
  isVisible,
  projectPoint,
  rotateBy,
  type GlobeView,
} from '../globeProjection';

const SIZE = geoSizes.board;
const kenya = countryByIso('KE');
const africa: GlobeView = { lng: 20, lat: 0, zoom: 1 };

const wrap = (ui: ReactElement) => (
  <GestureHandlerRootView>
    <ThemeProvider scheme={campScheme}>{ui}</ThemeProvider>
  </GestureHandlerRootView>
);
const renderGlobe = (ui: ReactElement) => render(wrap(ui));

/** Fires a completed tap at (x, y) on the globe's tap gesture. */
const tapAt = async (x: number, y: number) =>
  act(async () => {
    fireGestureHandler(getByGestureTestId('geo.globe.tap'), [
      { x, y },
      { x, y },
    ]);
  });

describe('globe math', () => {
  it('inverts the centre of the initial view to Central Asia', () => {
    const at = invertPoint(SIZE, initialView, { x: SIZE / 2, y: SIZE / 2 });
    expect(at?.lng).toBeCloseTo(60, 5);
    expect(at?.lat).toBeCloseTo(30, 5);
    expect(invertPoint(SIZE, initialView, { x: 1, y: 1 })).toBeNull();
  });

  it('finds Kenya, ignores the ocean and hides the far side', () => {
    expect(countryAt({ lat: 0.5, lng: 37.9 })).toBe('KE');
    expect(countryAt({ lat: -30, lng: -20 })).toBeNull();
    expect(isVisible(initialView, { lat: -30, lng: -120 })).toBe(false);
    expect(projectPoint(SIZE, initialView, { lat: -30, lng: -120 })).toBeNull();
  });

  it('clamps latitude at ±85° and zoom to 1–8', () => {
    expect(rotateBy(initialView, 0, 100000, SIZE).lat).toBe(85);
    expect(rotateBy(initialView, 0, -100000, SIZE).lat).toBe(-85);
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(20)).toBe(8);
  });
});

describe('Globe, country mode', () => {
  it('selects Kenya when its centroid is tapped', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(
      <Globe mode="country" focus={africa} onSelectCountry={onSelectCountry} />,
    );
    const at = projectPoint(SIZE, africa, kenya!)!;
    await tapAt(at.x, at.y);
    expect(onSelectCountry).toHaveBeenCalledWith(
      'KE',
      expect.objectContaining({ lat: expect.any(Number) }),
    );
  });

  it('selects Vatican City from its microstate button and shows the chip', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(
      <Globe
        mode="country"
        focus={{ lat: 42, lng: 12 }}
        onSelectCountry={onSelectCountry}
      />,
    );
    await fireEvent.press(screen.getByTestId('geo.micro.VA'));
    expect(onSelectCountry).toHaveBeenCalledWith('VA', {
      lat: 41.903,
      lng: 12.453,
    });
    await screen.rerender(
      wrap(
        <Globe mode="country" focus={{ lat: 42, lng: 12 }} selectedIso="IT" />,
      ),
    );
    expect(screen.getByTestId('geo.selected')).toHaveTextContent('Italy');
  });

  it('ignores taps and microstate presses when disabled', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(
      <Globe
        mode="country"
        focus={africa}
        disabled
        onSelectCountry={onSelectCountry}
      />,
    );
    const at = projectPoint(SIZE, africa, kenya!)!;
    await tapAt(at.x, at.y);
    await fireEvent.press(screen.getByTestId('geo.micro.ST'));
    expect(onSelectCountry).not.toHaveBeenCalled();
  });
});

describe('Globe, point mode and reveal', () => {
  it('drops a pin on tap and renders my pin', async () => {
    const onDropPin = jest.fn();
    await renderGlobe(
      <Globe mode="point" myPin={{ lat: 30, lng: 60 }} onDropPin={onDropPin} />,
    );
    await tapAt(SIZE / 2, SIZE / 2);
    expect(onDropPin).toHaveBeenCalledTimes(1);
    expect(onDropPin.mock.calls[0][0].lat).toBeCloseTo(30, 5);
    expect(screen.getByTestId('geo.my-pin')).toBeOnTheScreen();
  });

  it('renders the answer and one pin per visible seat', async () => {
    await renderGlobe(
      <Globe
        mode="point"
        disabled
        focus={kenya}
        focusZoom={4}
        answer={{ iso: 'KE', point: kenya }}
        pins={[
          { seatId: 'host', point: kenya!, label: 'You', colorIndex: 0 },
          {
            seatId: 'p1',
            point: { lat: -1.3, lng: 36.8 },
            label: '145 km',
            colorIndex: 1,
          },
          {
            seatId: 'far',
            point: { lat: 0, lng: -140 },
            label: '9000 km',
            colorIndex: 2,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('geo.answer')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.pin.host')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.pin.p1')).toHaveTextContent('145 km');
    expect(screen.queryByTestId('geo.pin.far')).toBeNull();
  });
});

describe('Globe zoom', () => {
  it('zooms in and out with the buttons, within 1–8×', async () => {
    await renderGlobe(<Globe mode="country" />);
    const zoom = () =>
      screen.getByTestId('geo.globe').props.accessibilityValue.now;
    expect(zoom()).toBe(1);
    await fireEvent.press(screen.getByLabelText('Zoom in'));
    expect(zoom()).toBe(1.6);
    await fireEvent.press(screen.getByTestId('geo.zoom-out'));
    await fireEvent.press(screen.getByTestId('geo.zoom-out'));
    expect(zoom()).toBe(1);
  });
});

describe('Globe drag', () => {
  it('rotates without a single React render while dragging', async () => {
    const onRender = jest.fn();
    const onDropPin = jest.fn();
    await renderGlobe(
      <Profiler id="globe" onRender={onRender}>
        <Globe mode="point" onDropPin={onDropPin} />
      </Profiler>,
    );
    const before = onRender.mock.calls.length;
    await act(async () => {
      fireGestureHandler(getByGestureTestId('geo.globe.pan'), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 40, translationY: 10 },
        { translationX: 80, translationY: 30 },
        { translationX: 120, translationY: 60 },
        { state: State.END, translationX: 140, translationY: 70 },
      ]);
    });
    expect(onRender.mock.calls.length).toBe(before);
    // The drag did rotate: the centre is no longer Central Asia (60°E, 30°N).
    await tapAt(SIZE / 2, SIZE / 2);
    const centre = onDropPin.mock.calls[0][0];
    expect(centre.lng).toBeLessThan(initialView.lng - 10);
    expect(centre.lat).toBeGreaterThan(initialView.lat + 2);
  });
});
