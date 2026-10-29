import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { apiError, goOffline, qaEvents, renderApp, sessionBody, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { tokenManager } from '../../../shared/api/tokenManager';
import { storage } from '../../../shared/storage';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000c1';
const PLACE_URL = `/v1/places/${ID}`;
const CHECK_INS_URL = '/v1/check-ins';
const DEMO_URL = '/v1/auth/demo';
const MERGE_URL = '/v1/me/guest-merge';
const LAT = 41.5;
const LNG = 70.1;

/** Synthetic place — not a real seed row. */
const placeBody = {
  id: ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: LAT,
  longitude: LNG,
  elevationM: 1940,
  difficulty: 3,
  requiredLevel: 1,
  distanceM: 4249,
  region: null,
  description: { uz: 'Birinchi.', ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: true },
  checkInRadiusM: 300,
};

const resultBody = {
  id: '00000000-0000-4000-8000-0000000000d1',
  placeId: ID,
  recordedAt: '2026-10-21T05:00:00.000Z',
  counted: true,
  xp: 80,
  levelUps: [],
  pathVisited: false,
};

const demoSession = () => sessionBody({ username: 'explorer_1234', isDemo: true, level: 1, xpTotal: 0 });

const fix: GeolocationResponse = {
  coords: { latitude: LAT, longitude: LNG, accuracy: 12, altitude: 1900, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: Date.now(),
};

function queued(): unknown[] {
  return JSON.parse(storage.getString('checkIn.queue') ?? '[]');
}

/** The order the app hit the demo / merge / check-in endpoints. */
function flow(): string[] {
  const watched = [DEMO_URL, MERGE_URL, CHECK_INS_URL];
  return http.calls.map(call => call.url ?? '').filter(url => watched.includes(url));
}

async function guestOnPlace() {
  jest.mocked(Geolocation.requestAuthorization).mockImplementation(success => success?.());
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation(success => success({ ...fix, timestamp: Date.now() }));
  http.reply(PLACE_URL, { status: 200, body: placeBody });
  http.reply(MERGE_URL, { status: 200, body: { merged: [], skipped: [] } });
  http.reply('/v1/me', { status: 200, body: demoSession().me });
  await renderApp();
  await act(() => {
    navigationRef.navigate('Place', { id: ID });
  });
  await screen.findByTestId('checkin.button');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.mocked(Geolocation.requestAuthorization).mockReset();
  jest.mocked(Geolocation.getCurrentPosition).mockReset();
});

describe('check-in — guests get a demo account (AC6)', () => {
  it('AC6: a guest check-in is queued, then sync creates the demo account, merges and sends', async () => {
    await guestOnPlace();
    await goOffline();

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.queued')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.gate')).not.toBeOnTheScreen();
    expect(queued()).toHaveLength(1);

    http.reply(DEMO_URL, { status: 201, body: demoSession() });
    http.reply(CHECK_INS_URL, { status: 201, body: resultBody });
    await act(() => {
      onlineManager.setOnline(true);
    });

    await waitFor(() => expect(queued()).toEqual([]));
    expect(flow()).toEqual([DEMO_URL, MERGE_URL, CHECK_INS_URL]);
    expect(JSON.parse(String(http.callsTo(DEMO_URL)[0]?.data))).toEqual({ locale: 'en' });
    expect(await tokenManager.getRefreshToken()).toBe('refresh_token_1');
    expect(await screen.findByText('Your progress is saved as explorer_1234')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'demo_account_created' });
  });

  it('AC6: online, the guest check-in still queues first and syncs straight away, once', async () => {
    http.reply(DEMO_URL, { status: 201, body: demoSession() });
    http.reply(CHECK_INS_URL, { status: 201, body: resultBody });
    await guestOnPlace();

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.queued')).toBeOnTheScreen();
    await waitFor(() => expect(queued()).toEqual([]));
    expect(http.callsTo(DEMO_URL)).toHaveLength(1);
    expect(http.callsTo(CHECK_INS_URL)).toHaveLength(1);
  });

  it('AC6: DEMO_LIMIT keeps the queue and stays a guest', async () => {
    http.reply(DEMO_URL, apiError(429, 'DEMO_LIMIT'));
    await guestOnPlace();

    await fireEvent.press(screen.getByTestId('checkin.button'));

    await waitFor(() => expect(http.callsTo(DEMO_URL)).toHaveLength(1));
    await screen.findByTestId('summit.queued');
    expect(queued()).toHaveLength(1);
    expect(http.callsTo(CHECK_INS_URL)).toHaveLength(0);
    expect(await tokenManager.getRefreshToken()).toBeNull();
    expect(qaEvents()).not.toContainEqual({ event: 'demo_account_created' });
  });
});
