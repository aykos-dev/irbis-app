import { LocationManager } from '@maplibre/maplibre-react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { exploreFilters } from '../../../features/places/exploreFilters';
import { i18n } from '../../../shared/i18n';

let http: HttpStub;

const URL = '/v1/places';

/** Synthetic places — not real seed rows. */
const item = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000b${n}`,
  slug: `place-${n}`,
  name: { uz: `Joy ${n}`, ru: null, en: `Place ${n}` },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3000,
  difficulty: 3,
  requiredLevel: 2,
  distanceM: 4249 * n,
  ...overrides,
});

const listBody = (items: ReturnType<typeof item>[], origin: 'device' | 'tashkent', total = items.length) => ({
  items,
  nextCursor: null,
  origin,
  total,
});

function grantLocation() {
  jest.mocked(LocationManager.requestPermissions).mockResolvedValue(true);
  jest.mocked(LocationManager.getCurrentPosition).mockResolvedValue({
    coords: {
      latitude: 41.3,
      longitude: 69.2,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: 0,
  });
}

async function openExplore() {
  await renderApp();
  await openTab('explore');
  await screen.findByTestId('explore.screen');
}

async function press(testID: string) {
  await fireEvent.press(await screen.findByTestId(testID));
}

beforeEach(async () => {
  http = await setUpApp();
  exploreFilters.reset();
  jest.mocked(LocationManager.requestPermissions).mockResolvedValue(false);
  jest.mocked(LocationManager.getCurrentPosition).mockResolvedValue(undefined);
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('places — Explore list and origin (AC4, AC6)', () => {
  it('AC4/AC6: granted location sends coords, heads the list "near you" and opens a place with them', async () => {
    grantLocation();
    http.reply(URL, { status: 200, body: listBody([item(1), item(2, { type: 'lake' })], 'device') });
    http.reply(`${URL}/${item(1).id}`, { networkError: true });
    await openExplore();

    expect(await screen.findByTestId('explore.count')).toHaveTextContent('2 places near you');
    expect(screen.getByTestId('explore.card.place-2')).toHaveTextContent(/Place 2.*Lake · 8\.5 km/);
    expect(screen.queryByTestId('explore.location-banner')).not.toBeOnTheScreen();
    expect(http.callsTo(URL)).toHaveLength(1);
    expect(http.callsTo(URL)[0]?.params).toEqual({ lat: 41.3, lng: 69.2, limit: 200 });
    expect(qaEvents()).toEqual(
      expect.arrayContaining([
        { event: 'location_permission', result: 'granted' },
        { event: 'explore_loaded', count: 2, origin: 'device' },
      ]),
    );

    await press('explore.card.place-1');
    await screen.findByTestId('place.screen');
    expect(http.callsTo(`${URL}/${item(1).id}`)[0]?.params).toEqual({ lat: 41.3, lng: 69.2 });
  });

  it('AC6: refused location sends no coords, counts "from Tashkent" (ru plural) and offers Turn on', async () => {
    i18n.locale = 'ru';
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    http.reply(URL, { status: 200, body: listBody([item(1)], 'tashkent', 5) });
    await openExplore();

    expect(await screen.findByTestId('explore.count')).toHaveTextContent('5 мест от Ташкента');
    expect(http.callsTo(URL)[0]?.params).toEqual({ limit: 200 });
    expect(screen.getByTestId('explore.location-banner')).toHaveTextContent(
      /Включите геолокацию, чтобы видеть расстояние от вас/,
    );
    expect(qaEvents()).toContainEqual({ event: 'location_permission', result: 'blocked' });

    await press('explore.location-turn-on');
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('AC6: a throwing permission request falls back to Tashkent with the banner, never an endless skeleton', async () => {
    jest.mocked(LocationManager.requestPermissions).mockRejectedValue(new Error('location services unavailable'));
    http.reply(URL, { status: 200, body: listBody([item(1)], 'tashkent') });
    await openExplore();

    expect(await screen.findByTestId('explore.count')).toHaveTextContent('1 place from Tashkent');
    expect(screen.getByTestId('explore.location-banner')).toBeOnTheScreen();
    expect(http.callsTo(URL)[0]?.params).toEqual({ limit: 200 });
    expect(qaEvents()).toContainEqual({ event: 'location_permission', result: 'unavailable' });
  });

  it('AC6: Android — PermissionsAndroid denied shows the banner and sends no coords', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    const request = jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
      } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    try {
      http.reply(URL, { status: 200, body: listBody([item(1)], 'tashkent') });
      await openExplore();

      expect(await screen.findByTestId('explore.count')).toHaveTextContent('1 place from Tashkent');
      expect(screen.getByTestId('explore.location-banner')).toBeOnTheScreen();
      expect(http.callsTo(URL)[0]?.params).toEqual({ limit: 200 });
      expect(request).toHaveBeenCalledTimes(1);
      expect(qaEvents()).toContainEqual({ event: 'location_permission', result: 'denied' });
    } finally {
      request.mockRestore();
      Platform.OS = os;
    }
  });
});

describe('places — Explore filters (AC5)', () => {
  it('AC5: Type, Difficulty and Distance go into one query and label their chips', async () => {
    http.reply(URL, { status: 200, body: listBody([item(1)], 'tashkent') });
    await openExplore();
    await screen.findByTestId('explore.count');

    await press('explore.filter.type');
    for (const type of ['peak', 'lake', 'cave']) {
      await press(`explore.filter-option.type-${type}`);
    }
    await press('explore.filter.apply');
    expect(await screen.findByTestId('explore.filter.type')).toHaveTextContent('Peaks · Lakes +1');

    await press('explore.filter.difficulty');
    await press('explore.filter-option.difficulty-min-2');
    await press('explore.filter-option.difficulty-max-4');
    await press('explore.filter.apply');
    expect(await screen.findByTestId('explore.filter.difficulty')).toHaveTextContent('Difficulty 2–4');

    await press('explore.filter.distance');
    await press('explore.filter-option.distance-100');
    await press('explore.filter.apply');
    expect(await screen.findByTestId('explore.filter.distance')).toHaveTextContent('≤ 100 km');

    await screen.findByTestId('explore.count');
    expect(http.callsTo(URL).at(-1)?.params).toEqual({
      types: ['peak', 'lake', 'cave'],
      difficultyMin: 2,
      difficultyMax: 4,
      maxDistanceKm: 100,
      limit: 200,
    });
    expect(qaEvents()).toContainEqual({
      event: 'explore_filters_applied',
      types: 'peak,lake,cave',
      difficultyMin: 2,
      difficultyMax: 4,
      maxKm: 100,
      count: 1,
    });
  });

  it('AC5: no matches show the empty state; Reset filters clears every filter', async () => {
    http.handle(URL, config =>
      config.params?.types
        ? { status: 200, body: listBody([], 'tashkent') }
        : { status: 200, body: listBody([item(1)], 'tashkent') },
    );
    exploreFilters.set({ types: ['canyon'], difficulty: { min: 4, max: 5 }, maxKm: 50 });
    await openExplore();

    expect(await screen.findByTestId('explore.empty')).toHaveTextContent(/No places match these filters/);
    await press('explore.filter.reset');

    expect(await screen.findByTestId('explore.count')).toHaveTextContent('1 place from Tashkent');
    expect(screen.getByTestId('explore.filter.type')).toHaveTextContent('Type');
    expect(screen.getByTestId('explore.filter.distance')).toHaveTextContent('Distance');
    expect(http.callsTo(URL).at(-1)?.params).toEqual({ limit: 200 });
  });
});
