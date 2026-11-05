import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  apiError,
  meBody,
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

/** Wednesday 2026-10-21 10:00 in Tashkent: the form defaults to Saturday the 24th. */
const NOW = new Date('2026-10-21T05:00:00Z');
const PLACE_ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000b1';
const GROUP_ID = '00000000-0000-4000-8000-0000000000c1';
const ME_ID = '00000000-0000-4000-8000-000000000001';
const LEADER_ID = '00000000-0000-4000-8000-000000000002';
const JOINER_ID = '00000000-0000-4000-8000-000000000003';
const PLACE_URL = `/v1/places/${PLACE_ID}`;
const TRIP_URL = `/v1/group-trips/${TRIP_ID}`;
const CONTACT_URL = '/v1/me/emergency-contact';

/** Synthetic rows only — no real people or seed places. */
const placeBody = {
  id: PLACE_ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3309,
  difficulty: 3,
  requiredLevel: 3,
  distanceM: 4249,
  region: null,
  description: { uz: null, ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 4, qualifies: true },
};

const conditionBody = {
  placeId: PLACE_ID,
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

const contactBody = { name: 'guest_2', relation: 'sister', phoneMasked: '+998 ** *** ** 67' };

const groupsBody = (role: 'owner' | 'member') => ({
  yours: [
    {
      id: GROUP_ID,
      slug: 'group-1',
      name: 'Group 1',
      description: '',
      visibility: 'public',
      avatarUrl: null,
      color: 'teal',
      memberCount: 4,
      unreadCount: 0,
      viewerMembership: { role, status: 'active', joinedAt: '2026-10-01T08:00:00.000Z', notificationsMuted: false },
    },
  ],
  invitations: [],
  discover: [],
});

const person = (id: string, username: string, level: number) => ({ id, username, displayName: null, level });

const tripBody = (overrides: Record<string, unknown> = {}) => ({
  id: TRIP_ID,
  place: {
    id: PLACE_ID,
    slug: 'place-1',
    names: { uz: 'Joy 1', ru: 'Joy 1', en: 'Place 1' },
    type: 'peak',
    difficulty: 3,
    requiredLevel: 3,
  },
  visibility: 'public',
  status: 'open',
  startAt: '2026-10-24T02:00:00.000Z',
  backBy: '2026-10-24T12:30:00.000Z',
  meeting: { text: 'Bus stop 1', lat: null, lng: null },
  carpool: null,
  maxPeople: 10,
  minLevel: 3,
  gear: { keys: ['water'], custom: [] },
  description: '',
  leader: { ...person(LEADER_ID, 'guest_3', 5), verifiedLeader: true },
  groups: [{ id: GROUP_ID, name: 'Group 1' }],
  approvedCount: 1,
  spotsLeft: 9,
  me: null,
  participants: [person(LEADER_ID, 'guest_3', 5)],
  requests: [],
  ...overrides,
});

async function signIn({ role = 'owner' as 'owner' | 'member', contact = true } = {}) {
  http.reply('/v1/me', { status: 200, body: meBody({ id: ME_ID, isDemo: false }) });
  http.reply('/v1/groups', { status: 200, body: groupsBody(role) });
  http.reply(PLACE_URL, { status: 200, body: placeBody });
  http.reply(`${PLACE_URL}/condition`, { status: 200, body: conditionBody });
  http.reply(`${PLACE_URL}/trip-preview`, {
    status: 200,
    body: { sunsetAt: '2026-10-24T12:45:00.000Z', daylightBufferMin: 75, gear: [{ key: 'water', litres: 1.5 }] },
  });
  http.reply(CONTACT_URL, contact ? { status: 200, body: contactBody } : { status: 204, body: '' });
  await startSignedIn();
  await renderApp();
}

async function openPlace() {
  await act(() => {
    navigationRef.navigate('Place', { id: PLACE_ID });
  });
  await screen.findByTestId('place.name');
}

async function openCreate() {
  await openPlace();
  await fireEvent.press(await screen.findByTestId('place.create-trip'));
  await screen.findByTestId('create-trip.place');
  await fireEvent.changeText(screen.getByTestId('create-trip.meeting'), 'Bus stop 1');
}

async function openTrip(body: ReturnType<typeof tripBody>) {
  http.reply(TRIP_URL, { status: 200, body });
  await act(() => {
    navigationRef.navigate('GroupTrip', { id: TRIP_ID });
  });
  await screen.findByTestId('group-trip.place');
}

const posted = (url: string) => http.calls.filter(call => call.url === url && call.method === 'post');

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('trip-events — Place button (AC1, AC8)', () => {
  it('hides "Create a group trip" for a plain group member', async () => {
    await signIn({ role: 'member' });
    await openPlace();
    await screen.findByTestId('place.condition');
    expect(screen.queryByTestId('place.create-trip')).not.toBeOnTheScreen();
  });
});

describe('trip-events — Create trip (AC1, AC8)', () => {
  it('publishes the form and opens the trip page with a toast', async () => {
    await signIn();
    await openCreate();
    expect(await screen.findByTestId('create-trip.gear-water')).toBeSelected();
    await fireEvent.press(screen.getByTestId('create-trip.group-' + GROUP_ID));
    await fireEvent.press(screen.getByTestId('create-trip.private'));
    http.reply('/v1/group-trips', { status: 201, body: tripBody({ visibility: 'private' }) });

    await fireEvent.press(screen.getByTestId('create-trip.publish'));

    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
    expect(screen.getByTestId('app.toast')).toHaveTextContent('Trip published');
    expect(JSON.parse(String(posted('/v1/group-trips')[0]?.data))).toEqual({
      placeId: PLACE_ID,
      groupIds: [GROUP_ID],
      visibility: 'private',
      startAt: '2026-10-24T02:00:00.000Z',
      backBy: '2026-10-24T12:30:00.000Z',
      meetingText: 'Bus stop 1',
      minLevel: 3,
      gearKeys: ['water'],
      customGear: [],
      description: '',
    });
  });

  it('maps a 422 field error onto its section and stays on the form', async () => {
    await signIn();
    await openCreate();
    http.reply(
      '/v1/group-trips',
      apiError(422, 'GROUP_TRIP_INVALID', { fieldErrors: { meetingText: ['length'] } }),
    );
    await fireEvent.press(screen.getByTestId('create-trip.publish'));
    expect(await screen.findByTestId('create-trip.error-meeting')).toHaveTextContent('Check the meeting point.');
    expect(screen.getByTestId('create-trip.screen')).toBeOnTheScreen();
  });
});

describe('trip-events — trip page (AC3–AC5)', () => {
  it('AC3: asks to join after saving an emergency contact, then shows "Request sent"', async () => {
    await signIn({ contact: false });
    await openTrip(tripBody());
    await fireEvent.press(screen.getByTestId('group-trip.join'));

    http.reply(CONTACT_URL, { status: 200, body: contactBody });
    await fireEvent.changeText(await screen.findByTestId('group-trip.contact-name'), 'guest_2');
    await fireEvent.changeText(screen.getByTestId('group-trip.contact-relation'), 'sister');
    await fireEvent.changeText(screen.getByTestId('group-trip.contact-phone'), '901234567');
    await fireEvent.press(screen.getByTestId('group-trip.contact-save'));

    http.reply(`${TRIP_URL}/requests`, { status: 200, body: tripBody({ me: { role: 'member', status: 'pending' } }) });
    await fireEvent.changeText(await screen.findByTestId('group-trip.join-note'), 'First time up here');
    await fireEvent.press(screen.getByTestId('group-trip.join-send'));

    expect(await screen.findByTestId('group-trip.my-status')).toHaveTextContent('Request sent');
    expect(JSON.parse(String(posted(`${TRIP_URL}/requests`)[0]?.data))).toEqual({ note: 'First time up here' });
  });

  it('AC4: the leader sees the request with level vs minimum and approves it', async () => {
    await signIn();
    await openTrip(
      tripBody({
        me: { role: 'leader', status: 'approved' },
        requests: [{ userId: JOINER_ID, username: 'guest_4', level: 2, note: 'Hi', createdAt: NOW.toISOString() }],
      }),
    );
    expect(screen.getByTestId(`group-trip.request-${JOINER_ID}`)).toHaveTextContent(/Level 2 · minimum 3/);
    http.reply(`${TRIP_URL}/requests/${JOINER_ID}/approve`, {
      status: 200,
      body: tripBody({
        me: { role: 'leader', status: 'approved' },
        approvedCount: 2,
        participants: [person(LEADER_ID, 'guest_3', 5), person(JOINER_ID, 'guest_4', 2)],
      }),
    });

    await fireEvent.press(screen.getByTestId(`group-trip.approve-${JOINER_ID}`));

    expect(await screen.findByTestId(`group-trip.participant-${JOINER_ID}`)).toBeOnTheScreen();
    expect(screen.getByTestId('group-trip.count')).toHaveTextContent('2 / 10 going');
    expect(screen.getByTestId('group-trip.requests-empty')).toBeOnTheScreen();
  });

  it('AC5: an approved member leaves after confirming', async () => {
    await signIn();
    await openTrip(tripBody({ me: { role: 'member', status: 'approved' } }));
    expect(screen.getByTestId('group-trip.my-status')).toHaveTextContent("You're in");
    http.reply(`${TRIP_URL}/leave`, { status: 204, body: '' });
    http.reply(TRIP_URL, { status: 200, body: tripBody({ me: { role: 'member', status: 'left' } }) });

    await fireEvent.press(screen.getByTestId('group-trip.leave'));
    await fireEvent.press(await screen.findByTestId('group-trip.leave-sheet-confirm'));

    expect(await screen.findByTestId('group-trip.join')).toBeOnTheScreen();
    expect(posted(`${TRIP_URL}/leave`)).toHaveLength(1);
  });

  it('AC5: the leader cancels the trip and the page shows the banner without actions', async () => {
    await signIn();
    await openTrip(tripBody({ me: { role: 'leader', status: 'approved' } }));
    http.reply(`${TRIP_URL}/cancel`, {
      status: 200,
      body: tripBody({ status: 'cancelled', me: { role: 'leader', status: 'approved' } }),
    });

    await fireEvent.press(screen.getByTestId('group-trip.cancel'));
    await fireEvent.press(await screen.findByTestId('group-trip.cancel-sheet-confirm'));

    expect(await screen.findByTestId('group-trip.cancelled')).toBeOnTheScreen();
    expect(screen.queryByTestId('group-trip.edit')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('group-trip.cancel')).not.toBeOnTheScreen();
  });
  it('refetches the Place trip list after the leader cancels, without a remount', async () => {
    await signIn();
    http.reply('/v1/group-trips', { status: 200, body: { items: [], nextCursor: null } });
    await openPlace();
    const listCalls = () => http.callsTo('/v1/group-trips').length;
    const before = listCalls();
    expect(before).toBeGreaterThan(0);
    await openTrip(tripBody({ me: { role: 'leader', status: 'approved' } }));
    http.reply(`${TRIP_URL}/cancel`, {
      status: 200,
      body: tripBody({ status: 'cancelled', me: { role: 'leader', status: 'approved' } }),
    });

    await fireEvent.press(screen.getByTestId('group-trip.cancel'));
    await fireEvent.press(await screen.findByTestId('group-trip.cancel-sheet-confirm'));

    expect(await screen.findByTestId('group-trip.cancelled')).toBeOnTheScreen();
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });
});
