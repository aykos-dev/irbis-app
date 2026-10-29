import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { apiError, goOffline, meBody, qaEvents, renderApp, setUpApp, startSignedIn, tearDownApp, type HttpStub } from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { storage } from '../../../shared/storage';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000c1';
const PLACE_URL = `/v1/places/${ID}`;
const CHECK_INS_URL = '/v1/check-ins';
const LAT = 41.5;
const LNG = 70.1;
/** About 0.0045° of latitude per 500 m. */
const FAR_LAT = LAT + 0.0045;

/** Synthetic place — not a real seed row. */
const placeBody = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const resultBody = (overrides: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-0000000000d1',
  placeId: ID,
  recordedAt: '2026-10-21T05:00:00.000Z',
  counted: true,
  xp: 80,
  levelUps: [],
  pathVisited: false,
  ...overrides,
});

const position = (latitude: number, accuracy = 12): GeolocationResponse => ({
  coords: { latitude, longitude: LNG, accuracy, altitude: 1900, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: Date.now(),
});

function fixAt(fix: GeolocationResponse) {
  jest.mocked(Geolocation.requestAuthorization).mockImplementation(success => success?.());
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation(success => success(fix));
}

async function openPlace(place = placeBody()) {
  http.reply('/v1/me', { status: 200, body: meBody({ level: 3, xpTotal: 0 }) });
  http.reply(PLACE_URL, { status: 200, body: place });
  await startSignedIn();
  await renderApp();
  await act(() => {
    navigationRef.navigate('Place', { id: ID });
  });
  await screen.findByTestId('checkin.button');
}

function queued(): unknown[] {
  return JSON.parse(storage.getString('checkIn.queue') ?? '[]');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.mocked(Geolocation.requestAuthorization).mockImplementation(
    (_success, error) => error && error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
  );
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation(
    (_success, error) => error && error({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
  );
});

describe('check-in — button (AC4)', () => {
  it('AC4: outside the radius it says how far and stores nothing', async () => {
    fixAt(position(FAR_LAT));
    await openPlace();

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('checkin.too-far')).toHaveTextContent(
      "You're 500 m away — get within 300 m to check in.",
    );
    expect(http.callsTo(CHECK_INS_URL)).toHaveLength(0);
    expect(queued()).toEqual([]);
    expect(qaEvents()).toContainEqual({ event: 'check_in_rejected', code: 'CHECK_IN_TOO_FAR' });
  });
});

describe('check-in — online send and Summit (AC5, AC7)', () => {
  it('AC7: a counted check-in at a peak opens Summit with the XP earned', async () => {
    fixAt(position(LAT));
    await openPlace();
    http.reply(CHECK_INS_URL, { status: 201, body: resultBody() });

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.screen')).toBeTruthy();
    expect(screen.getByTestId('summit.title')).toHaveTextContent('Summit reached!');
    expect(screen.getByTestId('summit.place')).toHaveTextContent('Place 1 · 1,940 m');
    expect(screen.getByTestId('summit.xp')).toHaveTextContent('+80 XP earned');
    const body = JSON.parse(String(http.callsTo(CHECK_INS_URL)[0]?.data));
    expect(body).toMatchObject({ placeId: ID, lat: LAT, lng: LNG, accuracyM: 12 });
    expect(qaEvents()).toContainEqual({ event: 'check_in_sent', placeId: ID, counted: true, xp: 80, queued: false });
  });

  it('AC7: a repeat this month at a lake says "Already counted" under "You made it!"', async () => {
    fixAt(position(LAT));
    await openPlace(placeBody({ type: 'lake', checkInRadiusM: 1000 }));
    http.reply(CHECK_INS_URL, { status: 201, body: resultBody({ counted: false, xp: 0 }) });

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.title')).toHaveTextContent('You made it!');
    expect(screen.getByTestId('summit.xp')).toHaveTextContent('Already counted this month');
  });
});

describe('check-in — offline queue (AC5)', () => {
  it('AC5: offline it queues, opens Summit queued, and sends the queue on reconnect', async () => {
    fixAt(position(LAT));
    await openPlace();
    await goOffline();

    await fireEvent.press(screen.getByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.queued')).toHaveTextContent(
      "Checked in · XP arrives when you're online",
    );
    expect(screen.queryByTestId('summit.xp')).toBeNull();
    expect(queued()).toHaveLength(1);
    expect(qaEvents()).toContainEqual({ event: 'check_in_queued', placeId: ID });

    http.reply(CHECK_INS_URL, { status: 201, body: resultBody() });
    await act(() => {
      onlineManager.setOnline(true);
    });

    await waitFor(() => expect(queued()).toEqual([]));
    expect(http.callsTo(CHECK_INS_URL)).toHaveLength(1);
    expect(qaEvents()).toContainEqual({ event: 'check_in_sent', placeId: ID, counted: true, xp: 80, queued: true });
  });

  it('AC5: a 422 on sync drops the item with one toast', async () => {
    const item = { clientId: '00000000-0000-4000-8000-0000000000e1', placeId: ID, lat: LAT, lng: LNG, accuracyM: 12, recordedAt: new Date().toISOString() };
    storage.setString('checkIn.queue', JSON.stringify([item, { ...item, clientId: '00000000-0000-4000-8000-0000000000e2' }]));
    http.reply('/v1/me', { status: 200, body: meBody({ level: 3, xpTotal: 0 }) });
    http.reply(CHECK_INS_URL, apiError(422, 'CHECK_IN_TOO_OLD'));
    await startSignedIn();
    await renderApp();
    await waitFor(() => expect(http.callsTo(CHECK_INS_URL).length).toBeGreaterThan(0));

    expect(await screen.findByTestId('app.toast')).toHaveTextContent("This check-in couldn't be verified");
    await waitFor(() => expect(queued()).toEqual([]));
    expect(screen.getAllByTestId('app.toast')).toHaveLength(1);
    expect(qaEvents().filter(entry => entry.event === 'check_in_rejected')).toEqual([
      { event: 'check_in_rejected', code: 'CHECK_IN_TOO_OLD' },
      { event: 'check_in_rejected', code: 'CHECK_IN_TOO_OLD' },
    ]);
  });
});
