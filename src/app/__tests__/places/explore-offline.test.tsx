import { LocationManager } from '@maplibre/maplibre-react-native';
import { act, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import {
  goOffline,
  openTab,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { exploreFilters } from '../../../features/places/exploreFilters';

let http: HttpStub;
let appStateListeners: ((status: AppStateStatus) => void)[] = [];

/** Synthetic place — not a real seed row. */
const item = {
  id: '00000000-0000-4000-8000-0000000000b1',
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3000,
  difficulty: 3,
  requiredLevel: 2,
  distanceM: 4249,
  conditionStatus: 'caution',
};

const fix = {
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
};

beforeEach(async () => {
  http = await setUpApp();
  exploreFilters.reset();
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener);
    return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(async () => {
  await tearDownApp(http);
  jest.mocked(LocationManager.requestPermissions).mockResolvedValue(false);
  jest.mocked(LocationManager.getCurrentPosition).mockResolvedValue(undefined);
  jest.mocked(AppState.addEventListener).mockRestore();
});

describe('conditions — Explore offline (AC8, D1)', () => {
  it('AC8 (D1): offline Explore keeps the last loaded list with its status chip when the origin changes', async () => {
    // Location allowed but no fix yet: the list loads from Tashkent.
    jest.mocked(LocationManager.requestPermissions).mockResolvedValue(true);
    jest.mocked(LocationManager.getCurrentPosition).mockRejectedValue(new Error('no fix'));
    http.reply('/v1/places', {
      status: 200,
      body: { items: [item], nextCursor: null, origin: 'tashkent', total: 1 },
    });
    await renderApp();
    await openTab('explore');
    expect(await screen.findByTestId('explore.card.place-1.status')).toHaveTextContent('Caution');

    // Offline, the app comes back to the foreground and a fix arrives: the origin moves to the device.
    await goOffline();
    jest.mocked(LocationManager.getCurrentPosition).mockResolvedValue(fix);
    await act(async () => {
      appStateListeners.forEach(listener => listener('active'));
    });

    expect(screen.getByTestId('explore.card.place-1.status')).toHaveTextContent('Caution');
    expect(screen.queryByTestId('explore.offline')).not.toBeOnTheScreen();
  });
});
