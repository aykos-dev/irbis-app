import { act, fireEvent, screen } from '@testing-library/react-native';

import {
  apiError,
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
import { storage } from '../../../shared/storage';

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

/** Wednesday 2026-10-21 10:00 in Tashkent: next Sat is the 24th, next Sun the 25th. */
const NOW = new Date('2026-10-21T05:00:00Z');
const ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000t1';
const PLACE_URL = `/v1/places/${ID}`;
const CONDITION_URL = `${PLACE_URL}/condition`;
const PREVIEW_URL = `${PLACE_URL}/trip-preview`;
const CONTACT_URL = '/v1/me/emergency-contact';

/** Synthetic place — not a real seed row. */
const placeBody = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3309,
  difficulty: 3,
  requiredLevel: 4,
  distanceM: 4249,
  region: null,
  description: { uz: null, ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: false },
  ...overrides,
});

const conditionBody = (status: string) => ({
  placeId: ID,
  status,
  source: 'forecast',
  reasons: [],
  text: null,
  opensMonth: null,
  hazards: [],
  weekend: [],
  forecastAt: NOW.toISOString(),
  computedAt: NOW.toISOString(),
});

const previewBody = (overrides: Record<string, unknown> = {}) => ({
  sunsetAt: '2026-10-24T12:45:00.000Z',
  daylightBufferMin: 75,
  gear: [
    { key: 'water', litres: 1.5 },
    { key: 'warmLayer', note: 'frost' },
    { key: 'firstAid' },
  ],
  ...overrides,
});

/** Synthetic contact (never a real person); the API only ever returns the masked phone. */
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

function stubPlace(status = 'go') {
  http.reply(PLACE_URL, { status: 200, body: placeBody() });
  http.reply(CONDITION_URL, { status: 200, body: conditionBody(status) });
}

async function openPlace({ signedIn = true } = {}) {
  if (signedIn) {
    http.reply('/v1/me', { status: 200, body: meBody() });
    await startSignedIn();
  }
  await renderApp();
  await act(() => {
    navigationRef.navigate('Place', { id: ID });
  });
  await screen.findByTestId('place.name');
}

async function openPlan({ contact = true, preview = previewBody() } = {}) {
  stubPlace();
  http.reply(PREVIEW_URL, { status: 200, body: preview });
  http.reply(CONTACT_URL, contact ? { status: 200, body: contactBody } : { status: 204, body: '' });
  await openPlace();
  await fireEvent.press(await screen.findByTestId('place.start-adventure'));
  await screen.findByTestId('trip.screen');
}

/** Fires the mocked native picker as if the user picked `value`. */
async function pick(testID: string, value: Date) {
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent(screen.getByTestId(`${testID}.picker`), 'change', { type: 'set' }, value);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('trip-plan — Place CTA (AC1)', () => {
  it('AC1: hides "Start adventure" for a Not now place', async () => {
    stubPlace('not_now');
    await openPlace();
    await screen.findByTestId('place.condition');
    expect(screen.queryByTestId('place.start-adventure')).not.toBeOnTheScreen();
  });

  it('AC1: a guest gets the account gate instead of the plan', async () => {
    stubPlace('go');
    await openPlace({ signedIn: false });
    await fireEvent.press(await screen.findByTestId('place.start-adventure'));
    expect(await screen.findByTestId('auth.gate')).toBeOnTheScreen();
    expect(screen.queryByTestId('trip.screen')).not.toBeOnTheScreen();
  });

  it('AC1: opens the plan with the place and a level caution below the required level', async () => {
    await openPlan();
    expect(await screen.findByTestId('trip.place-name')).toHaveTextContent('Place 1');
    expect(screen.getByTestId('trip.level-caution')).toHaveTextContent('Recommended from Level 4');
    expect(qaEvents()).toContainEqual({ event: 'trip_plan_open', placeId: ID, belowLevel: true });
  });
});

describe('trip-plan — times and sunset (AC2, AC3)', () => {
  it('AC2: defaults to next Saturday 07:00–17:30 and previews that window', async () => {
    await openPlan();
    expect(screen.getByTestId('trip.date.sat')).toBeSelected();
    expect(screen.getByTestId('trip.start-time')).toHaveTextContent('07:00');
    expect(screen.getByTestId('trip.backby-time')).toHaveTextContent('17:30');
    expect(await screen.findByTestId('trip.sunset')).toHaveTextContent(
      'Sunset 17:45 · that leaves 75 min of daylight buffer.',
    );
    expect(http.callsTo(PREVIEW_URL)[0]?.params).toEqual({
      startAt: '2026-10-24T02:00:00.000Z',
      backBy: '2026-10-24T12:30:00.000Z',
    });
  });

  it('AC2: back-by before start shows the inline error and blocks Save and Start', async () => {
    await openPlan();
    await pick('trip.backby-time', new Date(2026, 9, 24, 6, 0));
    expect(await screen.findByTestId('trip.times-error')).toHaveTextContent(
      'Back by must be after start and within 3 days.',
    );
    expect(screen.getByTestId('trip.save')).toBeDisabled();
    expect(screen.getByTestId('trip.start')).toBeDisabled();
  });

  it('AC3: a negative buffer warns about the dark; no buffer shows the sunset only', async () => {
    await openPlan({ preview: previewBody({ daylightBufferMin: -20 }) });
    expect(await screen.findByTestId('trip.after-dark')).toHaveTextContent(/after dark/);

    http.reply(PREVIEW_URL, { status: 200, body: previewBody({ daylightBufferMin: null }) });
    await pick('trip.backby-time-day', new Date(2026, 9, 25, 17, 30));
    expect(await screen.findByText('Sunset 17:45')).toBeOnTheScreen();
    expect(screen.queryByTestId('trip.after-dark')).not.toBeOnTheScreen();
  });
});

describe('trip-plan — contact and gear (AC4, AC5)', () => {
  it('AC4: without a contact Save and Start are disabled; adding one saves it with +998', async () => {
    await openPlan({ contact: false });
    expect(await screen.findByTestId('trip.footnote')).toHaveTextContent('Add an emergency contact to continue.');
    expect(screen.getByTestId('trip.start')).toBeDisabled();

    http.reply(CONTACT_URL, { status: 200, body: contactBody });
    await fireEvent.press(screen.getByTestId('trip.contact.add'));
    await fireEvent.changeText(screen.getByTestId('trip.contact.name'), 'guest_2');
    await fireEvent.changeText(screen.getByTestId('trip.contact.relation'), 'sister');
    await fireEvent.changeText(screen.getByTestId('trip.contact.phone'), '901234567');
    await fireEvent.press(screen.getByTestId('trip.contact.save'));

    expect(await screen.findByTestId('trip.contact.summary')).toHaveTextContent('guest_2 · sister');
    const put = http.calls.find(call => call.url === CONTACT_URL && call.method === 'put');
    expect(JSON.parse(String(put?.data))).toEqual({ name: 'guest_2', relation: 'sister', phone: '+998901234567' });
    expect(screen.getByTestId('trip.start')).not.toBeDisabled();
  });

  it('AC5: ticking gear updates the count and keeps the tick on the device', async () => {
    await openPlan();
    expect(await screen.findByTestId('trip.gear.count')).toHaveTextContent('0 / 3 packed');
    expect(screen.getByTestId('trip.gear.water')).toHaveTextContent('Water, 1.5 litres');
    await fireEvent.press(screen.getByTestId('trip.gear.water'));
    expect(screen.getByTestId('trip.gear.count')).toHaveTextContent('1 / 3 packed');
    expect(storage.getString(`trip.gear.draft.${ID}`)).toBe('["water"]');
  });
});

describe('trip-plan — save and start (AC6)', () => {
  it('AC6: Save plan creates a planned trip, toasts and goes back', async () => {
    await openPlan();
    await screen.findByTestId('trip.sunset');
    expect(screen.getByTestId('trip.alert-at')).toHaveTextContent(/^guest_2 is alerted at 18:30/);
    http.reply('/v1/trips', { status: 201, body: tripBody() });
    http.reply('/v1/trips/current', { status: 200, body: { active: null, planned: [tripBody()] } });

    await fireEvent.press(screen.getByTestId('trip.save'));

    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Plan saved');
    const post = http.calls.find(call => call.url === '/v1/trips' && call.method === 'post');
    expect(JSON.parse(String(post?.data))).toEqual({
      placeId: ID,
      startAt: '2026-10-24T02:00:00.000Z',
      backBy: '2026-10-24T12:30:00.000Z',
      alertEnabled: true,
      start: false,
    });
    expect(qaEvents()).toContainEqual({ event: 'trip_saved', tripId: TRIP_ID });
    expect(screen.queryByTestId('trip.screen')).not.toBeOnTheScreen();
  });

  it('AC6: Start with a trip already in progress shows "already active" and stays', async () => {
    await openPlan();
    await screen.findByTestId('trip.sunset');
    await fireEvent(screen.getByTestId('trip.alert-switch'), 'valueChange', false);
    expect(screen.getByTestId('trip.alert-at')).toHaveTextContent("Nobody is alerted if you're late.");
    http.reply('/v1/trips', apiError(409, 'TRIP_ALREADY_ACTIVE'));

    await fireEvent.press(screen.getByTestId('trip.start'));

    expect(await screen.findByTestId('app.toast')).toHaveTextContent('You already have a trip in progress.');
    const post = http.calls.find(call => call.url === '/v1/trips' && call.method === 'post');
    expect(JSON.parse(String(post?.data))).toMatchObject({ alertEnabled: false, start: true });
    expect(screen.getByTestId('trip.screen')).toBeOnTheScreen();
  });

  it('AC6: offline disables Save and Start with the offline note', async () => {
    await openPlan();
    await screen.findByTestId('trip.sunset');
    await goOffline();
    expect(screen.getByTestId('trip.footnote')).toHaveTextContent("You're offline. Connect to save or start.");
    expect(screen.getByTestId('trip.save')).toBeDisabled();
  });
});
