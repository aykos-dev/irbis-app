import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { apiError, goOffline, meBody, qaEvents, renderApp, setUpApp, startSignedIn, tearDownApp, type HttpStub } from '../auth/harness';
import { storage } from '../../../shared/storage';

let http: HttpStub;

/** Wednesday 2026-10-21 10:00 in Tashkent. */
const NOW = new Date('2026-10-21T05:00:00Z');
const MINUTE = 60_000;
const ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000t1';
const CURRENT_URL = '/v1/trips/current';
const WAYPOINTS_URL = `/v1/trips/${TRIP_ID}/waypoints`;
const SOS_URL = `/v1/trips/${TRIP_ID}/sos`;
const SOS_CONTACT_URL = `/v1/trips/${TRIP_ID}/sos-contact`;
const CHECKOUT_URL = `/v1/trips/${TRIP_ID}/check-out`;
const LIVE_URL = 'https://live.irbis.test/t/live_token_1';
/** Synthetic numbers — never a real person or service. */
const PHONE = '+998XXXXXXXXX';
const RESCUE = '+998YYYYYYYYY';

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
  contact: { name: 'guest_2', relation: 'sister', phoneMasked: '+998 ** *** ** 67' },
  liveUrl: LIVE_URL,
  lastLocationAt: null,
  distanceM: 0,
  climbM: 0,
  waypoints: [],
  pingEveryMin: 5,
  ...overrides,
});

const position = (latitude: number, accuracy = 10): GeolocationResponse => ({
  coords: { latitude, longitude: 70.1, accuracy, altitude: 1500, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: NOW.getTime(),
});

function fixAt(fix: GeolocationResponse) {
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation(success => success(fix));
}

function seedTrack() {
  storage.setString(
    'active.track',
    JSON.stringify({
      tripId: TRIP_ID,
      points: [[70.1, 41.6]],
      distanceM: 0,
      climbM: 0,
      anchorAlt: 1500,
      last: { lat: 41.6, lng: 70.1, alt: 1500, accuracyM: 12, at: NOW.getTime() - MINUTE },
    }),
  );
}

async function openActive(trip = activeBody(), contact: unknown = { phone: PHONE, sosCallNumber: RESCUE }) {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply(CURRENT_URL, { status: 200, body: { active: trip, planned: [] } });
  http.reply(SOS_CONTACT_URL, { status: 200, body: contact });
  await startSignedIn();
  await renderApp();
  await fireEvent.press(await screen.findByTestId('home.trip.open'));
  await screen.findByTestId('active.screen');
}

const result = (n: number, xp: number, lat = 41.5) => ({
  status: 200,
  body: { waypoint: { n, lat, lng: 70.1, recordedAt: NOW.toISOString() }, xpAwarded: xp },
});

/**
 * Moves the clock synchronously: async advancing would also add the real time the SOS ring's
 * animation frames take (advanceTimers) and run slowly.
 */
const hold = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

let openURL: jest.SpyInstance;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});
afterEach(async () => {
  await tearDownApp(http);
  openURL.mockRestore();
  jest.mocked(Geolocation.getCurrentPosition).mockImplementation(
    (_success, error) => error && error({ code: 2, message: 'unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }),
  );
  jest.useRealTimers();
});

describe('active-trip — waypoint check-ins (AC6)', () => {
  it('AC6: a check-in posts a fresh fix, floats the XP chip after the answer and sums XP into the summary', async () => {
    fixAt(position(41.5, 12.4));
    await openActive();
    expect(await screen.findByTestId('active.waypoint.next')).toHaveTextContent('Next: Waypoint 1');
    http.reply(WAYPOINTS_URL, result(1, 10));

    await fireEvent.press(screen.getByTestId('active.waypoint.checkin'));

    expect(await screen.findByTestId('active.waypoint.xp')).toHaveTextContent('+10 XP');
    expect(screen.getByTestId('active.waypoint.next')).toHaveTextContent('Next: Waypoint 2');
    expect(jest.mocked(Geolocation.getCurrentPosition).mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 10_000,
      maximumAge: 0,
    });
    expect(JSON.parse(String(http.callsTo(WAYPOINTS_URL)[0]?.data))).toEqual({
      lat: 41.5,
      lng: 70.1,
      accuracyM: 12,
      recordedAt: NOW.toISOString(),
    });
    expect(qaEvents()).toContainEqual({ event: 'waypoint_checked_in', tripId: TRIP_ID, n: 1, xp: 10, queued: false });

    const done = activeBody({ status: 'completed', checkedOutAt: NOW.toISOString(), waypoints: [result(1, 10).body.waypoint] });
    http.reply(CHECKOUT_URL, { status: 200, body: done });
    http.reply(CURRENT_URL, { status: 200, body: { active: null, planned: [] } });
    await fireEvent.press(screen.getByTestId('active.checkout'));
    await fireEvent.press(await screen.findByTestId('active.checkout.confirm'));
    expect(await screen.findByTestId('summary.xp')).toHaveTextContent('+10');
    expect(screen.getByTestId('summary.waypoints')).toHaveTextContent('1');
    expect(storage.getString('active.waypointXp')).toBeUndefined();
    expect(storage.getString('active.sosContact')).toBeUndefined();
  });

  it.each([
    [apiError(409, 'WAYPOINT_TOO_CLOSE', { details: { remainingM: 120 } }), 'Walk 120 m more for the next waypoint'],
    [apiError(409, 'WAYPOINT_TOO_SOON', { details: { remainingMin: 4 } }), 'Next waypoint in 4 min'],
    [apiError(422, 'LOCATION_INACCURATE'), 'GPS is too weak here — try in the open'],
    [apiError(409, 'WAYPOINT_LIMIT'), 'All 5 waypoints logged'],
  ])('AC6: a refused check-in shows its message (%#)', async (reply, text) => {
    fixAt(position(41.5));
    await openActive();
    http.reply(WAYPOINTS_URL, reply);
    await fireEvent.press(await screen.findByTestId('active.waypoint.checkin'));

    expect(await screen.findByTestId('active.waypoint.msg')).toHaveTextContent(text);
    expect(screen.queryByTestId('active.waypoint.xp')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'waypoint_rejected', tripId: TRIP_ID, code: reply.body.code });
    if (reply.body.code === 'WAYPOINT_LIMIT') {
      expect(screen.getByTestId('active.waypoint.checkin')).toBeDisabled();
    }
  });

  it('AC6: no fix or a weak fix → "GPS is too weak" and nothing is sent', async () => {
    await openActive();
    await fireEvent.press(await screen.findByTestId('active.waypoint.checkin'));
    expect(await screen.findByTestId('active.waypoint.msg')).toHaveTextContent(/GPS is too weak here/);

    fixAt(position(41.5, 80));
    await fireEvent.press(screen.getByTestId('active.waypoint.checkin'));
    await waitFor(() => expect(qaEvents().filter(e => e.event === 'waypoint_rejected')).toHaveLength(2));
    expect(http.callsTo(WAYPOINTS_URL)).toHaveLength(0);
  });

  it('AC6: offline → local spacing check and queue; on reconnect the queue is sent in order with the XP chip', async () => {
    const first = { n: 1, lat: 41.49, lng: 70.1, recordedAt: new Date(NOW.getTime() - 30 * MINUTE).toISOString() };
    await openActive(activeBody({ waypoints: [first] }));
    expect(await screen.findByTestId('active.waypoint.next')).toHaveTextContent('Next: Waypoint 2');
    await goOffline();

    fixAt(position(41.4905));
    await fireEvent.press(screen.getByTestId('active.waypoint.checkin'));
    expect(await screen.findByTestId('active.waypoint.msg')).toHaveTextContent('Walk 445 m more for the next waypoint');

    fixAt(position(41.5));
    await fireEvent.press(screen.getByTestId('active.waypoint.checkin'));
    await waitFor(() => expect(screen.getByTestId('active.waypoint.msg')).toHaveTextContent('Saved — syncs when online'));
    expect(screen.getByTestId('active.waypoint.next')).toHaveTextContent('Next: Waypoint 3');
    expect(http.callsTo(WAYPOINTS_URL)).toHaveLength(0);
    expect(screen.queryByTestId('active.waypoint.xp')).not.toBeOnTheScreen();

    http.reply(WAYPOINTS_URL, result(2, 10));
    await act(() => onlineManager.setOnline(true));

    expect(await screen.findByTestId('active.waypoint.xp')).toHaveTextContent('+10 XP');
    expect(http.callsTo(WAYPOINTS_URL)).toHaveLength(1);
    expect(qaEvents()).toContainEqual({ event: 'waypoint_checked_in', tripId: TRIP_ID, n: 2, xp: 10, queued: true });
    expect(storage.getString('active.waypointQueue')).toBeUndefined();
  });
});

describe('active-trip — SOS hold (AC7)', () => {
  it('AC7: releasing before 3 s cancels and sends nothing', async () => {
    await openActive();
    const sos = await screen.findByTestId('active.sos');
    expect(screen.getByTestId('active.sos.ring')).toBeOnTheScreen();
    await fireEvent(sos, 'pressIn');
    await hold(2000);
    await fireEvent(sos, 'pressOut');
    await hold(3000);

    expect(qaEvents()).toContainEqual({ event: 'sos_hold_cancelled' });
    expect(http.callsTo(SOS_URL)).toHaveLength(0);
    expect(screen.queryByTestId('sos.sheet')).not.toBeOnTheScreen();
  });

  it('AC7: a 3 s hold online sends the last fix; the sheet names the contact and Call dials the rescue number', async () => {
    seedTrack();
    await openActive();
    http.reply(SOS_URL, { status: 201, body: { sentAt: NOW.toISOString(), contactName: 'guest_2', sosCallNumber: RESCUE } });
    const sos = await screen.findByTestId('active.sos');
    await fireEvent(sos, 'pressIn');
    await hold(3000);

    expect(await screen.findByTestId('sos.sheet')).toHaveTextContent(/SOS sent to guest_2/);
    expect(JSON.parse(String(http.callsTo(SOS_URL)[0]?.data))).toEqual({ lat: 41.6, lng: 70.1, accuracyM: 12 });
    expect(qaEvents()).toContainEqual({ event: 'sos_sent', tripId: TRIP_ID, via: 'server' });
    expect(openURL).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('sos.call'));
    expect(openURL).toHaveBeenCalledWith(`tel:${RESCUE}`);
    expect(JSON.stringify(qaEvents())).not.toContain(PHONE);
  });

  it('AC7: offline → the SMS app opens with the SOS text to the contact; no call button without a number', async () => {
    await openActive(activeBody(), { phone: PHONE, sosCallNumber: null });
    await waitFor(() => expect(http.callsTo(SOS_CONTACT_URL)).toHaveLength(1));
    const sos = await screen.findByTestId('active.sos');
    await goOffline();
    await fireEvent(sos, 'pressIn');
    await hold(3000);

    expect(await screen.findByTestId('sos.sheet')).toHaveTextContent(/Tap Send in your SMS app/);
    const text = `SOS from guest_1 near Place 1. Location: https://maps.google.com/?q=41.50000,70.10000. Live: ${LIVE_URL} — Irbis`;
    expect(openURL).toHaveBeenCalledWith(`sms:${PHONE}&body=${encodeURIComponent(text)}`);
    expect(http.callsTo(SOS_URL)).toHaveLength(0);
    expect(qaEvents()).toContainEqual({ event: 'sos_sent', tripId: TRIP_ID, via: 'sms_app' });
    expect(screen.queryByTestId('sos.call')).not.toBeOnTheScreen();
  });

  it('AC7: a 502 also falls back to the SMS app; 429 shows the retry toast', async () => {
    await openActive();
    await waitFor(() => expect(http.callsTo(SOS_CONTACT_URL)).toHaveLength(1));
    http.reply(SOS_URL, apiError(502, 'SMS_FAILED'), apiError(429, 'SOS_TOO_SOON', { details: { retryInSec: 40 } }));
    const sos = await screen.findByTestId('active.sos');
    await fireEvent(sos, 'pressIn');
    await hold(3000);
    await waitFor(() => expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/^sms:\+998XXXXXXXXX&body=/)));
    await fireEvent.press(await screen.findByTestId('sos.close'));
    await fireEvent(sos, 'pressOut');

    await fireEvent(sos, 'pressIn');
    await hold(3000);
    expect(await screen.findByText('You can send another SOS in 40 s')).toBeOnTheScreen();
  });
});
