import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import type { LatLng } from '../../../../../shared/utils/geo';
import { campScheme, geoSizes } from '../../../campTheme';
import { countryByIso } from '../geoData';
import { Globe } from '../Globe';
import {
  countryAt,
  fromMercator,
  isoFilter,
  mapStyle,
  maxZoomFor,
  microDots,
  pixelDistance,
  toMercator,
  worldSize,
} from '../mapGeometry';

type Recorded = Record<string, unknown>;
type MapMock = {
  camera: { easeTo: jest.Mock; zoomTo: jest.Mock; jumpTo: jest.Mock };
  layers: Map<string, Recorded>;
  map: { props: Recorded | null };
};

/* A recording MapLibre double: the map's props, every layer's props and the camera's calls. */
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const camera = { easeTo: jest.fn(), zoomTo: jest.fn(), jumpTo: jest.fn() };
  const layers = new Map();
  const map: { props: Recorded | null } = { props: null };
  return {
    __mock: { camera, layers, map },
    Map: (props: Recorded & { children?: unknown; testID?: string; onPress?: unknown }) => {
      map.props = props;
      return React.createElement(View, { testID: props.testID, onPress: props.onPress }, props.children);
    },
    Camera: ({ ref }: { ref?: unknown }) => {
      React.useImperativeHandle(ref, () => camera);
      return null;
    },
    GeoJSONSource: ({ children }: { children?: unknown }) =>
      React.createElement(React.Fragment, null, children),
    Layer: (props: Recorded & { id: string }) => {
      layers.set(props.id, props);
      return null;
    },
    Marker: ({ children }: { children?: unknown }) => children,
  };
});

const mock = jest.requireMock<{ __mock: MapMock }>('@maplibre/maplibre-react-native').__mock;

const kenya = countryByIso('KE')!;

const wrap = (ui: ReactElement) => <ThemeProvider scheme={campScheme}>{ui}</ThemeProvider>;
const renderGlobe = (ui: ReactElement) => render(wrap(ui));

/** A real touch on the map: MapLibre reports its geographic point. */
const pressAt = async (at: LatLng) =>
  act(async () => {
    fireEvent(screen.getByTestId('geo.globe.map'), 'press', {
      nativeEvent: { lngLat: [at.lng, at.lat], point: [0, 0] },
    });
  });

/** The map moved to `zoom` (MapLibre's region event). */
const zoomedTo = async (zoom: number) =>
  act(async () => {
    const done = mock.map.props?.onRegionDidChange as (event: unknown) => void;
    done({ nativeEvent: { zoom } });
  });

/** The point `dx`, `dy` pt away from `at` on screen at `zoom`. */
const offset = (at: LatLng, dx: number, dy: number, zoom: number): LatLng => {
  const p = toMercator(at);
  return fromMercator(p.x + dx / worldSize(zoom), p.y + dy / worldSize(zoom));
};

beforeEach(() => {
  mock.camera.easeTo.mockClear();
  mock.camera.zoomTo.mockClear();
  mock.layers.clear();
});

describe('offline map style and layers', () => {
  it('the style has no http(s) URL, no glyphs, no sprite and no tile source; the map gets it', async () => {
    await renderGlobe(<Globe mode="country" />);
    const json = JSON.stringify(mapStyle);
    expect(json).not.toMatch(/https?:/);
    expect(mapStyle).not.toHaveProperty('glyphs');
    expect(mapStyle).not.toHaveProperty('sprite');
    expect(mapStyle.sources).toEqual({});
    expect(mapStyle.layers.map(layer => layer.type)).toEqual(['background']);
    expect(mock.map.props?.mapStyle).toBe(mapStyle);
    expect(mock.map.props).toMatchObject({ logo: false, compass: false, attribution: false });
    expect([...mock.layers.values()].map(layer => layer.type)).not.toContain('symbol');
  });

  it('the selected and answer fills filter on the iso', async () => {
    await renderGlobe(<Globe mode="country" selectedIso="KE" answer={{ iso: 'UZ' }} />);
    expect(mock.layers.get('geo-selected')?.filter).toEqual(['==', ['get', 'iso'], 'KE']);
    expect(mock.layers.get('geo-answer')?.filter).toEqual(['==', ['get', 'iso'], 'UZ']);
    expect(isoFilter(null)).toEqual(['==', ['get', 'iso'], '']);
  });
});

describe('microstate dots', () => {
  it('no two shown dots are closer than 18 pt at any integer zoom 0–8', () => {
    for (let zoom = 0; zoom <= 8; zoom++) {
      const shown = microDots.filter(dot => dot.minZoom <= zoom);
      shown.forEach((dot, i) =>
        shown.slice(i + 1).forEach(other => {
          expect(pixelDistance(dot.at, other.at, zoom)).toBeGreaterThanOrEqual(geoSizes.microGap);
        }),
      );
    }
    expect(microDots.filter(dot => dot.minZoom === 0).length).toBeGreaterThan(0);
    expect(microDots.every(dot => dot.minZoom <= maxZoomFor(0))).toBe(true);
  });
});

describe('Globe taps, country mode', () => {
  it('a press on Kenya selects KE; the ocean selects nothing', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(<Globe mode="country" onSelectCountry={onSelectCountry} />);
    await pressAt({ lat: 0.5, lng: 37.9 });
    expect(onSelectCountry).toHaveBeenCalledWith('KE', { lat: 0.5, lng: 37.9 });
    await pressAt({ lat: -30, lng: -20 });
    expect(onSelectCountry).toHaveBeenCalledTimes(1);
  });

  it('a press on the Comoros dot centre at the world zoom selects KM', async () => {
    const onSelectCountry = jest.fn();
    const comoros = microDots.find(dot => dot.iso === 'KM')!;
    expect(comoros.minZoom).toBe(0);
    await renderGlobe(<Globe mode="country" onSelectCountry={onSelectCountry} />);
    await pressAt(comoros.at);
    expect(onSelectCountry).toHaveBeenCalledWith('KM', comoros.at);
  });

  it('over the ocean a press 15 pt from a visible dot still snaps to it', async () => {
    const onSelectCountry = jest.fn();
    const malta = microDots.find(dot => dot.iso === 'MT')!;
    await renderGlobe(<Globe mode="country" onSelectCountry={onSelectCountry} />);
    await zoomedTo(malta.minZoom);
    const ocean = offset(malta.at, 15, 0, malta.minZoom);
    expect(countryAt(ocean)).toBeNull();
    await pressAt(ocean);
    expect(onSelectCountry).toHaveBeenCalledWith('MT', malta.at);
  });

  it("a press within 10 pt of Vatican's visible dot selects VA even over Italy", async () => {
    const onSelectCountry = jest.fn();
    const vatican = microDots.find(dot => dot.iso === 'VA')!;
    await renderGlobe(
      <Globe mode="country" focus={{ lat: 42, lng: 12 }} onSelectCountry={onSelectCountry} />,
    );
    await zoomedTo(vatican.minZoom);
    const near = offset(vatican.at, 6, -6, vatican.minZoom);
    expect(countryAt(near)).toBe('IT');
    await pressAt(near);
    expect(onSelectCountry).toHaveBeenCalledWith('VA', { lat: 41.903, lng: 12.453 });
    const italy = offset(vatican.at, 12, -12, vatican.minZoom);
    expect(countryAt(italy)).toBe('IT');
    await pressAt(italy);
    expect(onSelectCountry).toHaveBeenLastCalledWith('IT', italy);
  });

  it('a hidden dot (zoomed out below its minZoom) is never picked', async () => {
    const onSelectCountry = jest.fn();
    const vatican = microDots.find(dot => dot.iso === 'VA')!;
    expect(vatican.minZoom).toBeGreaterThan(0);
    await renderGlobe(<Globe mode="country" onSelectCountry={onSelectCountry} />);
    await zoomedTo(vatican.minZoom - 1);
    await pressAt(offset(vatican.at, 4, 4, vatican.minZoom - 1));
    expect(onSelectCountry).toHaveBeenCalledTimes(1);
    expect(onSelectCountry).not.toHaveBeenCalledWith('VA', expect.anything());
  });

  it('selects Vatican City from its screen-reader button; the selection is never named', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(<Globe mode="country" onSelectCountry={onSelectCountry} />);
    await fireEvent.press(screen.getByTestId('geo.micro.VA'));
    expect(onSelectCountry).toHaveBeenCalledWith('VA', { lat: 41.903, lng: 12.453 });
    await screen.rerender(wrap(<Globe mode="country" selectedIso="IT" />));
    expect(screen.queryByText('Italy')).toBeNull();
    expect(screen.getByTestId('geo.globe').props.accessibilityValue.text).toBe(
      'Country selected',
    );
  });

  it('ignores presses and microstate buttons when disabled', async () => {
    const onSelectCountry = jest.fn();
    await renderGlobe(<Globe mode="country" disabled onSelectCountry={onSelectCountry} />);
    await pressAt({ lat: 0.5, lng: 37.9 });
    await fireEvent.press(screen.getByTestId('geo.micro.ST'));
    expect(onSelectCountry).not.toHaveBeenCalled();
  });
});

describe('Globe, point mode and reveal', () => {
  it('drops a pin on press (longitude normalised) and renders my pin', async () => {
    const onDropPin = jest.fn();
    await renderGlobe(<Globe mode="point" myPin={{ lat: 30, lng: 60 }} onDropPin={onDropPin} />);
    await pressAt({ lat: 30, lng: 420 });
    expect(onDropPin).toHaveBeenCalledWith({ lat: 30, lng: 60 });
    expect(screen.getByTestId('geo.my-pin')).toBeOnTheScreen();
    expect(screen.queryByTestId('geo.micro.VA')).toBeNull();
  });

  it('renders the answer and one pin per seat with its label', async () => {
    await renderGlobe(
      <Globe
        mode="point"
        disabled
        focus={kenya}
        focusZoom={4}
        answer={{ iso: 'KE', point: kenya }}
        pins={[
          { seatId: 'host', point: kenya, label: 'You', colorIndex: 0 },
          { seatId: 'p1', point: { lat: -1.3, lng: 36.8 }, label: '145 km', colorIndex: 1 },
        ]}
      />,
    );
    expect(screen.getByTestId('geo.answer')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.pin.host')).toHaveTextContent('You');
    expect(screen.getByTestId('geo.pin.p1')).toHaveTextContent('145 km');
  });
});

describe('Globe camera', () => {
  it('a new focus eases the camera there in 600 ms; focusZoom 4 is two levels in', async () => {
    await renderGlobe(<Globe mode="country" />);
    expect(mock.camera.easeTo).not.toHaveBeenCalled();
    await screen.rerender(wrap(<Globe mode="country" focus={kenya} focusZoom={4} />));
    expect(mock.camera.easeTo).toHaveBeenCalledWith({
      center: [kenya.lng, kenya.lat],
      zoom: 2,
      duration: 600,
    });
    await screen.rerender(
      wrap(<Globe mode="country" focus={{ lat: 10, lng: 200 }} focusZoom={2} />),
    );
    expect(mock.camera.easeTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ center: [-160, 10], zoom: 1 }),
    );
  });

  it('zooms one level in and out with the buttons, within the fitted world and +3', async () => {
    await renderGlobe(<Globe mode="country" />);
    const zoom = () => screen.getByTestId('geo.globe').props.accessibilityValue.now;
    expect(zoom()).toBe(0);
    await fireEvent.press(screen.getByLabelText('Zoom in'));
    expect(mock.camera.zoomTo).toHaveBeenLastCalledWith(1, expect.anything());
    expect(zoom()).toBe(1);
    await fireEvent.press(screen.getByTestId('geo.zoom-out'));
    await fireEvent.press(screen.getByTestId('geo.zoom-out'));
    expect(zoom()).toBe(0);
    const max = maxZoomFor(0);
    for (let i = 0; i < max + 2; i++) {
      await fireEvent.press(screen.getByTestId('geo.zoom-in'));
    }
    expect(zoom()).toBe(max);
  });
});
