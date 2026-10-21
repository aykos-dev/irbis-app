import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { goOffline, meBody, qaEvents, renderApp, setUpApp, startSignedIn, tearDownApp, type HttpStub } from '../auth/harness';
import { storage } from '../../../shared/storage';

let http: HttpStub;

/** Wednesday 2026-10-21 10:00 in Tashkent. */
const NOW = new Date('2026-10-21T05:00:00Z');
const MINUTE = 60_000;
const ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000t1';
const CURRENT_URL = '/v1/trips/current';
const PINGS_URL = `/v1/trips/${TRIP_ID}/locations`;
const CHECKOUT_URL = `/v1/trips/${TRIP_ID}/check-out`;
/** Synthetic live link — not a real share token. */
const LIVE_URL = 'https://live.irbis.test/t/live_token_1';

/** Synthetic contact (never a real person); the API only returns the masked phone. */
const contactBody = { name: 'guest_2', relation: 'sister', phoneMasked: '+998 ** *** ** 67' };

/** Started today 08:00, back by 17:30 Tashkent, pings every 5 min. */
const activeBody = (overrides: Record<string, unknown> = {}) => ({
  id: TRIP_ID,
  place: { id: ID, slug: 'place-1', nameUz: 'Joy 1', nameRu: null, nameEn: 'Place 1', type: 'peak', latitude: 41.5, longitude: 70.1 },
  status: 'active',
  startAt: '2026-10-21T03:00:00.000Z',
  backBy: '2026-10-21T12:30:00.000Z',
  alertAt: '2026-10-21T13:30:00.000Z',
  alertEnabled: true,
  startedAt: '2026-10-21T03:00:00.000Z',
  checkedOutAt: null,
  alertSentAt: null,
  contact: contactBody,
  liveUrl: LIVE_URL,
  lastLocationAt: null,
  distanceM: 0,
  climbM: 0,
  waypoints: [],
  pingEveryMin: 5,
  ...overrides,
});

/** A track recorded before the restart: 4.2 km, 120 m climbed, one fix. */
function seedTrack() {
  storage.setString(
    'active.track',
    JSON.stringify({
      tripId: TRIP_ID,
      points: [[70.1, 41.5]],
      distanceM: 4200,
      climbM: 120,
      anchorAlt: 1500,
      last: { lat: 41.5, lng: 70.1, alt: 1500, accuracyM: 12, at: NOW.getTime() - MINUTE },
    }),
  );
}

const position = (latitude: number, accuracy = 10): GeolocationResponse => ({
  coords: { latitude, longitude: 70.1, accuracy, altitude: 1500, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: NOW.getTime(),
});

/** Grants location and returns a way to emit fixes into the watch. */
function grantWatch(): (fix: GeolocationResponse) => Promise<void> {
  let emit: (fix: GeolocationResponse) => void = () => undefined;
  jest.mocked(Geolocation.requestAuthorization).mockImplementation(success => success?.());
  jest.mocked(Geolocation.watchPosition).mockImplementation(success => {
    emit = success;
    return 1;
  });
  return async fix => {
    await act(() => emit(fix));
  };
}

async function openActive(current: unknown) {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply(CURRENT_URL, { status: 200, body: current });
  await startSignedIn();
  await renderApp();
  await fireEvent.press(await screen.findByTestId('home.trip.open'));
  await screen.findByTestId('active.screen');
}

const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.mocked(Geolocation.requestAuthorization).mockImplementation(
    (_success, error) => error && error({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
  );
  jest.mocked(Geolocation.watchPosition).mockImplementation(() => 0);
  jest.useRealTimers();
});

describe('active-trip — screen and stats (AC1, AC2)', () => {
  it('AC1+AC2: restores the saved track after a restart and shows status, back-by and stats', async () => {
    seedTrack();
    grantWatch();
    await openActive({ active: activeBody(), planned: [] });

    expect(await screen.findByTestId('active.status')).toHaveTextContent('LIVE · On track');
    expect(screen.getByTestId('active.backby')).toHaveTextContent('Back by 17:30');
    expect(screen.getByTestId('active.distance')).toHaveTextContent('4.2');
    expect(screen.getByTestId('active.climb')).toHaveTextContent('+120');
    expect(screen.getByTestId('active.elapsed')).toHaveTextContent('2:00');
    expect(screen.getByTestId('active.map')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'active_trip_open', tripId: TRIP_ID });

    await advance(MINUTE);
    expect(screen.getByTestId('active.elapsed')).toHaveTextContent('2:01');
  });

  it('AC2: accepted fixes grow the distance; an inaccurate fix is ignored', async () => {
    const emit = grantWatch();
    await openActive({ active: activeBody(), planned: [] });
    expect(await screen.findByText('Finding you…')).toBeOnTheScreen();
    await waitFor(() => expect(Geolocation.watchPosition).toHaveBeenCalled());
    expect(jest.mocked(Geolocation.watchPosition).mock.calls[0]?.[2]).toEqual({ enableHighAccuracy: true, distanceFilter: 10 });

    await emit(position(41.5));
    await emit(position(41.51, 80));
    await emit(position(41.509));
    expect(screen.getByTestId('active.distance')).toHaveTextContent('1.0');
    expect(screen.queryByText('Finding you…')).not.toBeOnTheScreen();
  });

  it('AC2: location refused → stats "—" and the turn-on row', async () => {
    await openActive({ active: activeBody(), planned: [] });
    expect(await screen.findByTestId('active.location-off')).toHaveTextContent(/Turn on location to track your route/);
    expect(screen.getByTestId('active.distance')).toHaveTextContent('—');
    expect(screen.getByTestId('active.climb')).toHaveTextContent('—');
  });

  it('AC1: past back-by reads "Running late"', async () => {
    await openActive({ active: activeBody({ backBy: '2026-10-21T04:30:00.000Z' }), planned: [] });
    expect(await screen.findByTestId('active.status')).toHaveTextContent('LIVE · Running late');
  });

  it('AC1: an alerted trip reads "Contact alerted"', async () => {
    await openActive({ active: activeBody({ status: 'alerted', alertSentAt: '2026-10-21T04:30:00.000Z' }), planned: [] });
    expect(await screen.findByTestId('active.status')).toHaveTextContent('Contact alerted');
  });

  it('AC1: no active trip → back to Path', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(CURRENT_URL, { status: 200, body: { active: activeBody(), planned: [] } });
    await startSignedIn();
    await renderApp();
    http.reply(CURRENT_URL, { status: 200, body: { active: null, planned: [] } });
    await fireEvent.press(await screen.findByTestId('home.trip.open'));
    await waitFor(() => expect(screen.getByTestId('path.screen')).toBeOnTheScreen());
  });
});

describe('active-trip — pings and contact row (AC3)', () => {
  it('AC3: pings every pingEveryMin with the latest fix and totals; the row moves to "just now"', async () => {
    seedTrack();
    http.reply(PINGS_URL, { status: 201, body: '' });
    await openActive({ active: activeBody({ lastLocationAt: '2026-10-21T04:50:00.000Z' }), planned: [] });
    expect(await screen.findByTestId('active.contact.last-sent')).toHaveTextContent(
      'guest_2 is following · last location sent 10 min ago',
    );

    await advance(4 * MINUTE);
    expect(http.callsTo(PINGS_URL)).toHaveLength(0);
    await advance(MINUTE);

    await waitFor(() => expect(http.callsTo(PINGS_URL)).toHaveLength(1));
    expect(JSON.parse(String(http.callsTo(PINGS_URL)[0]?.data))).toEqual({
      lat: 41.5,
      lng: 70.1,
      accuracyM: 12,
      recordedAt: new Date(NOW.getTime() - MINUTE).toISOString(),
      distanceM: 4200,
      climbM: 120,
    });
    expect(qaEvents()).toContainEqual({ event: 'trip_ping_sent', tripId: TRIP_ID, queued: false });
    await waitFor(() =>
      expect(screen.getByTestId('active.contact.last-sent')).toHaveTextContent(
        'guest_2 is following · last location sent just now',
      ),
    );
  });

  it('AC3: offline ticks send the latest fix once on reconnect, no backlog', async () => {
    seedTrack();
    http.reply(PINGS_URL, { status: 201, body: '' });
    await openActive({ active: activeBody(), planned: [] });
    expect(await screen.findByTestId('active.contact.last-sent')).toHaveTextContent(/location not sent yet/);

    await goOffline();
    await advance(10 * MINUTE);
    expect(http.callsTo(PINGS_URL)).toHaveLength(0);

    await act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(http.callsTo(PINGS_URL)).toHaveLength(1));
    expect(qaEvents()).toContainEqual({ event: 'trip_ping_sent', tripId: TRIP_ID, queued: true });
  });
});

describe('active-trip — live share (AC4)', () => {
  it('AC4: the share icon shares the live link text', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    try {
      await openActive({ active: activeBody(), planned: [] });
      await fireEvent.press(await screen.findByTestId('active.share-live'));
      expect(share).toHaveBeenCalledWith({ message: `Follow my trip to Place 1, back by 17:30: ${LIVE_URL}` });
      await waitFor(() => expect(qaEvents()).toContainEqual({ event: 'trip_live_shared', tripId: TRIP_ID }));
    } finally {
      share.mockRestore();
    }
  });

  it('AC4: no live link → no share icon', async () => {
    await openActive({ active: activeBody({ liveUrl: null }), planned: [] });
    await screen.findByTestId('active.contact');
    expect(screen.queryByTestId('active.share-live')).not.toBeOnTheScreen();
  });
});

describe('active-trip — check-out and summary (AC8)', () => {
  it('AC8: confirm sends the totals, clears the track and opens the summary; Done goes to Path', async () => {
    seedTrack();
    await openActive({ active: activeBody(), planned: [] });
    http.reply(CHECKOUT_URL, {
      status: 200,
      body: activeBody({ status: 'completed', checkedOutAt: NOW.toISOString(), distanceM: 4200, climbM: 120 }),
    });
    http.reply(CURRENT_URL, { status: 200, body: { active: null, planned: [] } });

    await fireEvent.press(await screen.findByTestId('active.checkout'));
    expect(await screen.findByText('This ends your trip and tells guest_2 you\'re back.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('active.checkout.confirm'));

    expect(await screen.findByTestId('summary.distance')).toHaveTextContent('4.2');
    expect(screen.getByTestId('summary.climb')).toHaveTextContent('+120');
    expect(screen.getByTestId('summary.time')).toHaveTextContent('2:00');
    expect(screen.getByTestId('summary.waypoints')).toHaveTextContent('0');
    expect(screen.getByTestId('summary.xp')).toHaveTextContent('+0');
    expect(screen.getByText('Welcome back!')).toBeOnTheScreen();
    expect(JSON.parse(String(http.callsTo(CHECKOUT_URL)[0]?.data))).toEqual({ distanceM: 4200, climbM: 120 });
    expect(qaEvents()).toContainEqual({ event: 'trip_checked_out', tripId: TRIP_ID, late: false, from: 'active' });
    expect(storage.getString('active.track')).toBeUndefined();

    await fireEvent.press(screen.getByTestId('summary.done'));
    expect(await screen.findByTestId('path.screen')).toBeOnTheScreen();
  });

  it('AC8: offline → check-out disabled with the offline label', async () => {
    await openActive({ active: activeBody(), planned: [] });
    await screen.findByTestId('active.checkout');
    await goOffline();
    expect(screen.getByTestId('active.checkout')).toBeDisabled();
    expect(screen.getByTestId('active.offline')).toHaveTextContent("You're offline");
  });
});
