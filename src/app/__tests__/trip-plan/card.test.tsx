import Geolocation from '@react-native-community/geolocation';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { PermissionsAndroid, Platform, Share } from 'react-native';

import {
  goOffline,
  meBody,
  qaEvents,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

jest.mock('@react-native-community/datetimepicker', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { testID?: string; onChange: unknown }) =>
      createElement(View, { testID: props.testID, onChange: props.onChange }),
  };
});

let http: HttpStub;

/** Wednesday 2026-10-21 10:00 in Tashkent. */
const NOW = new Date('2026-10-21T05:00:00Z');
const ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000t1';
const PLACE_URL = `/v1/places/${ID}`;
const CURRENT_URL = '/v1/trips/current';
const TRIP_URL = `/v1/trips/${TRIP_ID}`;

/** Synthetic place — not a real seed row. */
const placeBody = {
  id: ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3309,
  difficulty: 3,
  requiredLevel: 1,
  distanceM: 4249,
  region: null,
  description: { uz: null, ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: true },
};

const conditionBody = {
  placeId: ID,
  status: 'go',
  source: 'forecast',
  reasons: [],
  text: null,
  opensMonth: null,
  hazards: [],
  weekend: [],
  forecastAt: NOW.toISOString(),
  computedAt: NOW.toISOString(),
};

const previewBody = { sunsetAt: '2026-10-24T12:45:00.000Z', daylightBufferMin: 75, gear: [{ key: 'firstAid' }] };

/** Synthetic contact (never a real person); the API only returns the masked phone. */
const contactBody = { name: 'guest_2', relation: 'sister', phoneMasked: '+998 ** *** ** 67' };

const tripBody = (overrides: Record<string, unknown> = {}) => ({
  id: TRIP_ID,
  place: { id: ID, slug: 'place-1', nameUz: 'Joy 1', nameRu: null, nameEn: 'Place 1', type: 'peak', latitude: 41.5, longitude: 70.1 },
  status: 'planned',
  startAt: '2026-10-24T02:00:00.000Z',
  backBy: '2026-10-24T12:30:00.000Z',
  alertAt: '2026-10-24T13:30:00.000Z',
  alertEnabled: true,
  startedAt: null,
  checkedOutAt: null,
  alertSentAt: null,
  contact: contactBody,
  ...overrides,
});

/** Started today 08:00, back by 17:30 Tashkent. */
const activeBody = (overrides: Record<string, unknown> = {}) =>
  tripBody({
    status: 'active',
    startAt: '2026-10-21T03:00:00.000Z',
    backBy: '2026-10-21T12:30:00.000Z',
    alertAt: '2026-10-21T13:30:00.000Z',
    startedAt: '2026-10-21T03:00:00.000Z',
    ...overrides,
  });

function grantLocation() {
  jest.mocked(Geolocation.requestAuthorization).mockImplementationOnce(success => success?.());
  jest.mocked(Geolocation.getCurrentPosition).mockImplementationOnce(success =>
    success({
      coords: { latitude: 41.31, longitude: 69.28, accuracy: 25, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: NOW.getTime(),
    }),
  );
}

async function openHome(current: unknown) {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply(CURRENT_URL, { status: 200, body: current });
  await startSignedIn();
  await renderApp();
}

async function openPlan() {
  http.reply(PLACE_URL, { status: 200, body: placeBody });
  http.reply(`${PLACE_URL}/condition`, { status: 200, body: conditionBody });
  http.reply(`${PLACE_URL}/trip-preview`, { status: 200, body: previewBody });
  http.reply('/v1/me/emergency-contact', { status: 200, body: contactBody });
  await openHome({ active: null, planned: [] });
  await act(() => {
    navigationRef.navigate('TripPlan', { placeId: ID });
  });
  await screen.findByTestId('trip.sunset');
}

function postBody() {
  const post = http.calls.find(call => call.url === '/v1/trips' && call.method === 'post');
  return JSON.parse(String(post?.data));
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('trip-plan — share and start location (AC6)', () => {
  it('AC6: a share chip opens the share sheet with the plan text', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    try {
      await openPlan();
      await fireEvent.press(screen.getByTestId('trip.share.telegram'));
      expect(share).toHaveBeenCalledWith({
        message:
          "I'm going to Place 1 on Sat, Oct 24. Start 07:00, back by 17:30. If I don't check out, Irbis alerts guest_2 at 18:30.",
      });
      expect(qaEvents()).toContainEqual({ event: 'trip_shared', channel: 'telegram' });
    } finally {
      share.mockRestore();
    }
  });

  it('AC6: Start sends the device location when it is granted', async () => {
    await openPlan();
    grantLocation();
    http.reply('/v1/trips', { status: 201, body: activeBody() });
    await fireEvent.press(screen.getByTestId('trip.start'));
    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Have a great trip!');
    expect(postBody()).toMatchObject({ start: true, location: { lat: 41.31, lng: 69.28, accuracyM: 25 } });
    expect(Geolocation.getCurrentPosition).toHaveBeenLastCalledWith(expect.any(Function), expect.any(Function), {
      timeout: 10_000,
      enableHighAccuracy: false,
    });
    expect(qaEvents()).toContainEqual({ event: 'trip_started', tripId: TRIP_ID, hasLocation: true });
  });

  it('AC6: Android refused → asks once with the rationale, starts without location', async () => {
    const os = Platform.OS;
    Platform.OS = 'android';
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    try {
      await openPlan();
      http.reply('/v1/trips', { status: 201, body: activeBody() });
      await fireEvent.press(screen.getByTestId('trip.start'));
      expect(await screen.findByTestId('app.toast')).toHaveTextContent('Have a great trip!');
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]?.[1]).toMatchObject({
        message: "Irbis sends your start location to your contact only if you're late.",
      });
      expect(postBody()).not.toHaveProperty('location');
      expect(qaEvents()).toContainEqual({ event: 'trip_started', tripId: TRIP_ID, hasLocation: false });
    } finally {
      request.mockRestore();
      Platform.OS = os;
    }
  });
});

describe('trip-plan — Home trip card (AC7)', () => {
  it('AC7: a guest gets no card and no request', async () => {
    await renderApp();
    await screen.findByTestId('path.screen');
    expect(screen.queryByTestId('home.trip-card')).not.toBeOnTheScreen();
    expect(http.callsTo(CURRENT_URL)).toHaveLength(0);
  });

  it('AC7: check-out from the active trip toasts "Welcome back!"', async () => {
    await openHome({ active: activeBody(), planned: [] });
    const card = await screen.findByTestId('home.trip-card');
    expect(card).toHaveTextContent(/Place 1/);
    expect(card).toHaveTextContent(/Back by 17:30/);
    http.reply(`${TRIP_URL}/check-out`, { status: 200, body: activeBody({ status: 'completed' }) });
    http.reply(CURRENT_URL, { status: 200, body: { active: null, planned: [] } });

    await fireEvent.press(screen.getByTestId('home.trip.checkout'));

    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Welcome back!');
    expect(qaEvents()).toContainEqual({ event: 'trip_checked_out', tripId: TRIP_ID, late: false });
    await waitFor(() => expect(screen.queryByTestId('home.trip-card')).not.toBeOnTheScreen());
  });

  it('AC7: change back-by sends the picked time and shows it', async () => {
    await openHome({ active: activeBody(), planned: [] });
    await screen.findByTestId('home.trip-card');
    const moved = activeBody({ backBy: '2026-10-21T13:30:00.000Z' });
    http.reply(TRIP_URL, { status: 200, body: moved });
    http.reply(CURRENT_URL, { status: 200, body: { active: moved, planned: [] } });
    await fireEvent.press(screen.getByTestId('home.trip.backby'));
    await fireEvent.press(screen.getByTestId('home.trip.backby.time'));
    await fireEvent(screen.getByTestId('home.trip.backby.time.picker'), 'change', { type: 'set' }, new Date(2026, 9, 21, 18, 30));

    expect(await screen.findByText('Back by 18:30')).toBeOnTheScreen();
    const patch = http.calls.find(call => call.url === TRIP_URL && call.method === 'patch');
    expect(JSON.parse(String(patch?.data))).toEqual({ backBy: '2026-10-21T13:30:00.000Z' });
    expect(qaEvents()).toContainEqual({ event: 'trip_backby_changed', tripId: TRIP_ID });
  });

  it('AC7: an alerted trip shows who was alerted, keeps check-out, hides back-by', async () => {
    await openHome({ active: activeBody({ alertSentAt: '2026-10-21T04:50:00.000Z' }), planned: [] });
    expect(await screen.findByTestId('home.trip-card')).toHaveTextContent(/guest_2 was alerted/);
    expect(screen.getByTestId('home.trip.checkout')).toBeOnTheScreen();
    expect(screen.queryByTestId('home.trip.backby')).not.toBeOnTheScreen();
  });

  it('AC7: deleting a planned trip asks first, then removes it', async () => {
    await openHome({ active: null, planned: [tripBody()] });
    const row = await screen.findByTestId(`home.trip.planned.${TRIP_ID}`);
    expect(row).toHaveTextContent(/Planned · Sat, Oct 24/);
    http.reply(TRIP_URL, { status: 204, body: '' });
    http.reply(CURRENT_URL, { status: 200, body: { active: null, planned: [] } });

    await fireEvent.press(within(row).getByTestId('home.trip.planned.delete'));
    expect(await screen.findByText('Delete this trip plan?')).toBeOnTheScreen();
    expect(http.calls.some(call => call.method === 'delete')).toBe(false);
    await fireEvent.press(screen.getByTestId('home.trip.delete.confirm'));

    expect(qaEvents()).toContainEqual({ event: 'trip_deleted', tripId: TRIP_ID });
    expect(http.calls.some(call => call.url === TRIP_URL && call.method === 'delete')).toBe(true);
    await waitFor(() => expect(screen.queryByTestId('home.trip-card')).not.toBeOnTheScreen());
  });

  it('AC7: offline keeps the cached card with its buttons disabled', async () => {
    await openHome({ active: null, planned: [tripBody()] });
    await screen.findByTestId('home.trip-card');
    await goOffline();
    expect(screen.getByTestId('home.trip.planned.start')).toBeDisabled();
    expect(screen.getByTestId('home.trip.planned.delete')).toBeDisabled();
  });

  it('AC6 edit mode: Edit opens the saved plan; Start updates then starts it', async () => {
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    http.reply(`${PLACE_URL}/trip-preview`, { status: 200, body: previewBody });
    http.reply('/v1/me/emergency-contact', { status: 200, body: contactBody });
    await openHome({ active: null, planned: [tripBody()] });
    await fireEvent.press(await screen.findByTestId('home.trip.planned.edit'));
    await screen.findByTestId('trip.sunset');
    expect(screen.getByTestId('trip.backby-time')).toHaveTextContent('17:30');

    http.reply(TRIP_URL, { status: 200, body: tripBody() });
    http.reply(`${TRIP_URL}/start`, { status: 200, body: activeBody() });
    await fireEvent.press(screen.getByTestId('trip.start'));

    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Have a great trip!');
    const patch = http.calls.find(call => call.url === TRIP_URL && call.method === 'patch');
    expect(JSON.parse(String(patch?.data))).toEqual({
      startAt: '2026-10-24T02:00:00.000Z',
      backBy: '2026-10-24T12:30:00.000Z',
      alertEnabled: true,
    });
    expect(http.callsTo(`${TRIP_URL}/start`)).toHaveLength(1);
    expect(qaEvents()).toContainEqual({ event: 'trip_started', tripId: TRIP_ID, hasLocation: false });
  });
});
