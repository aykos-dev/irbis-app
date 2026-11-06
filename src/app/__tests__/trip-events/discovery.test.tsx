import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import {
  meBody,
  openTab,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

class FakeWebSocket {
  static readonly OPEN = 1;
  readonly readyState = FakeWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(_url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
  send(_value: string): void {}
  close(): void {}
}

let http: HttpStub;

/** Wednesday 2026-10-21 10:00 in Tashkent. */
const NOW = new Date('2026-10-21T05:00:00Z');
const PLACE_ID = '00000000-0000-4000-8000-0000000000a1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000b1';
const GROUP_ID = '00000000-0000-4000-8000-0000000000c1';
const LEADER_ID = '00000000-0000-4000-8000-000000000002';
const PLAN_ID = '00000000-0000-4000-8000-0000000000d1';
const PLACE_URL = `/v1/places/${PLACE_ID}`;

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
  startAt: '2026-10-24T00:30:00.000Z',
  backBy: '2026-10-24T12:30:00.000Z',
  meeting: { text: 'Bus stop 1', lat: null, lng: null },
  carpool: null,
  maxPeople: 10,
  minLevel: 3,
  gear: { keys: ['water'], custom: [] },
  description: '',
  leader: { ...person(LEADER_ID, 'guest_3', 5), verifiedLeader: true },
  groups: [{ id: GROUP_ID, name: 'Group 1' }],
  approvedCount: 6,
  spotsLeft: 4,
  me: null,
  participants: [person(LEADER_ID, 'guest_3', 5)],
  requests: [],
  ...overrides,
});

const page = (items: unknown[], nextCursor: string | null = null) => ({ status: 200, body: { items, nextCursor } });

async function signIn() {
  http.reply('/v1/me', { status: 200, body: meBody({ isDemo: false }) });
  http.reply('/v1/groups', { status: 200, body: { yours: [], invitations: [], discover: [] } });
  http.reply(`${PLACE_URL}/condition`, { status: 200, body: conditionBody });
  http.reply(`/v1/group-trips/${TRIP_ID}`, { status: 200, body: tripBody() });
  await startSignedIn();
  await renderApp();
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('trip-events — Groups "Upcoming group trips" (AC8)', () => {
  it('lists up to five trips with spots and condition; See all and a row open the trips', async () => {
    const trips = Array.from({ length: 6 }, (_, index) =>
      tripBody({ id: `00000000-0000-4000-8000-0000000001${index}0` }),
    );
    http.handle('/v1/group-trips', config => (config.params?.cursor ? page([]) : page([...trips.slice(0, 5), tripBody()], 'next')));
    await signIn();
    await openTab('community');
    await fireEvent.press(screen.getByTestId('community.segment.groups'));

    const row = await screen.findByTestId(`groups.upcoming-trip-${trips[0]?.id}`);
    expect(row).toHaveTextContent(/Place 1.*Sat, Oct 24 · 05:30 · 4 spots left/);
    expect(await within(row).findByText('Go')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^groups\.upcoming-trip-[^-]+-[^-]+-[^-]+-[^-]+-[^-]+$/)).toHaveLength(5);
    expect(http.callsTo('/v1/group-trips')[0]?.params).toEqual({ scope: 'upcoming' });

    await fireEvent.press(screen.getByTestId('groups.upcoming-see-all'));
    expect(await screen.findByTestId(`group-trips.trip-${TRIP_ID}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`group-trips.trip-${TRIP_ID}`));
    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
  });

  it('hides the section when there are no upcoming trips', async () => {
    http.reply('/v1/group-trips', page([]));
    await signIn();
    await openTab('community');
    await fireEvent.press(screen.getByTestId('community.segment.groups'));
    await screen.findByTestId('groups.screen');
    await waitFor(() => expect(http.callsTo('/v1/group-trips')).toHaveLength(1));
    expect(screen.queryByTestId('groups.upcoming')).not.toBeOnTheScreen();
  });
});

describe('trip-events — Place "Upcoming trips here" (AC8)', () => {
  it('shows the place trips and opens one', async () => {
    http.handle('/v1/group-trips', config =>
      config.params?.placeId === PLACE_ID ? page([tripBody({ maxPeople: null, spotsLeft: null })]) : page([]),
    );
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    await signIn();
    await act(() => {
      navigationRef.navigate('Place', { id: PLACE_ID });
    });
    const row = await screen.findByTestId(`place.upcoming-trip-${TRIP_ID}`);
    expect(row).toHaveTextContent('Sat, Oct 24 · 05:30 · 6 going');
    await fireEvent.press(row);
    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
  });

  it('hides the section when the place has no upcoming trips', async () => {
    http.reply('/v1/group-trips', page([]));
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    await signIn();
    await act(() => {
      navigationRef.navigate('Place', { id: PLACE_ID });
    });
    await screen.findByTestId('place.name');
    await waitFor(() => expect(http.callsTo('/v1/group-trips')).toHaveLength(1));
    expect(screen.queryByTestId('place.upcoming')).not.toBeOnTheScreen();
  });
});

describe('trip-events — Search Trips tab (AC8)', () => {
  it('searches trips between Groups and Tours and opens one; empty text when none', async () => {
    http.handle('/v1/search', config => ({
      status: 200,
      body: {
        places: [],
        people: [],
        groups: [],
        tours: [],
        trips:
          config.params?.q === 'pla'
            ? [{ id: TRIP_ID, placeName: 'Place 1', startAt: '2026-10-24T00:30:00.000Z', approvedCount: 6, maxPeople: 10 }]
            : [],
      },
    }));
    await signIn();
    await act(() => {
      navigationRef.navigate('Search');
    });
    const tabs = screen.getAllByRole('tab').map(tab => tab.props.accessibilityLabel);
    expect(tabs.slice(tabs.indexOf('Groups'), tabs.indexOf('Groups') + 3)).toEqual(['Groups', 'Trips', 'Tours']);

    await fireEvent.press(screen.getByTestId('search.segment.trips'));
    await fireEvent.changeText(screen.getByTestId('search.input'), 'zz');
    expect(await screen.findByTestId('search.trips-empty')).toHaveTextContent('No upcoming trips found.');

    await fireEvent.changeText(screen.getByTestId('search.input'), 'pla');
    const row = await screen.findByTestId(`search.trip-${TRIP_ID}`);
    expect(row).toHaveTextContent(/Place 1.*6 \/ 10 going/);
    expect(http.callsTo('/v1/search').at(-1)?.params).toEqual({ q: 'pla', scope: 'trips' });
    await fireEvent.press(row);
    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
  });
});

describe('trip-events — chat trip card (AC8)', () => {
  const message = (id: string, groupTripId: string | null, capacity: number) => ({
    id,
    groupId: GROUP_ID,
    kind: 'trip',
    author: null,
    body: null,
    replyTo: null,
    attachments: [],
    reactions: [],
    mentionedUserIds: [],
    readByCount: 0,
    trip: {
      groupTripId,
      title: 'Place 1',
      startsAt: '2026-10-24T00:30:00.000Z',
      meetingTime: '05:30',
      difficulty: 3,
      requiredLevel: 3,
      capacity,
      joined: 6,
      condition: 'go',
      imageUrl: null,
    },
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-10-20T10:00:00.000Z',
  });
  const LIVE = '00000000-0000-4000-8000-000000000061';
  const OPEN_ENDED = '00000000-0000-4000-8000-000000000062';
  const SEEDED = '00000000-0000-4000-8000-000000000063';

  it('a live card shows joined/capacity and condition and opens the trip; seeded stays read-only', async () => {
    Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: FakeWebSocket });
    http.reply(`/v1/groups/${GROUP_ID}`, {
      status: 200,
      body: {
        id: GROUP_ID,
        slug: 'group-1',
        name: 'Group 1',
        description: '',
        visibility: 'public',
        avatarUrl: null,
        color: '#0C807A',
        memberCount: 2,
        unreadCount: 0,
        viewerMembership: { role: 'member', status: 'active', joinedAt: '2026-10-01T08:00:00.000Z', notificationsMuted: false },
        members: [],
        pendingRequests: [],
      },
    });
    http.reply(`/v1/groups/${GROUP_ID}/messages`, page([message(LIVE, TRIP_ID, 10), message(OPEN_ENDED, TRIP_ID, 0), message(SEEDED, null, 10)]));
    http.reply(`/v1/groups/${GROUP_ID}/messages/read`, { status: 201, body: { status: 'read' } });
    await signIn();
    await act(() => {
      navigationRef.navigate('GroupChat', { id: GROUP_ID });
    });

    const live = await screen.findByTestId(`group-chat.trip-${LIVE}`);
    expect(screen.getByTestId(`group-chat.trip-${LIVE}-spots`)).toHaveTextContent('6/10 · 4 spots left');
    expect(screen.getByTestId(`group-chat.trip-${OPEN_ENDED}-spots`)).toHaveTextContent('6 going');
    expect(within(live).getByText('Go')).toBeOnTheScreen();
    expect(screen.getByTestId(`group-chat.trip-${SEEDED}`)).toHaveTextContent(/Trip joining ships with Trip Events/);

    await fireEvent.press(live);
    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
  });
});

describe('trip-events — Home group-linked plan (AC6, AC8)', () => {
  const contact = { name: 'guest_2', relation: 'sister', phoneMasked: '+998 ** *** ** 67' };
  const planned = {
    id: PLAN_ID,
    place: { id: PLACE_ID, slug: 'place-1', nameUz: 'Joy 1', nameRu: null, nameEn: 'Place 1', type: 'peak', latitude: 41.5, longitude: 70.1 },
    status: 'planned',
    startAt: '2026-10-24T00:30:00.000Z',
    backBy: '2026-10-24T12:30:00.000Z',
    alertAt: '2026-10-24T13:30:00.000Z',
    alertEnabled: true,
    startedAt: null,
    checkedOutAt: null,
    alertSentAt: null,
    contact,
    liveUrl: null,
    lastLocationAt: null,
    distanceM: 0,
    climbM: 0,
    waypoints: [],
    groupTripId: TRIP_ID,
    groupGear: { keys: ['water'], custom: ['Rope'] },
    pingEveryMin: 5,
  };

  it('tags the card "Group trip" and the title opens the trip page', async () => {
    http.reply('/v1/trips/current', { status: 200, body: { active: null, planned: [planned] } });
    await signIn();
    expect(await screen.findByTestId('home.trip.group-tag')).toHaveTextContent('Group trip');
    expect(screen.getByTestId('home.trip.planned.start')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('home.trip.group-open'));
    expect(await screen.findByTestId('group-trip.place')).toHaveTextContent('Place 1');
  });

  it('the plan gear asks the preview with groupTripId and lists the custom items', async () => {
    http.reply('/v1/trips/current', { status: 200, body: { active: null, planned: [planned] } });
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    http.reply('/v1/me/emergency-contact', { status: 200, body: contact });
    http.reply(`${PLACE_URL}/trip-preview`, {
      status: 200,
      body: {
        sunsetAt: '2026-10-24T12:45:00.000Z',
        daylightBufferMin: 15,
        gear: [{ key: 'water', litres: 1.5 }, { key: 'custom-0', label: 'Rope', custom: true }],
      },
    });
    await signIn();
    await fireEvent.press(await screen.findByTestId('home.trip.planned.edit'));
    expect(await screen.findByTestId('trip.gear.custom-0')).toHaveTextContent('Rope');
    expect(http.callsTo(`${PLACE_URL}/trip-preview`).at(-1)?.params).toMatchObject({ groupTripId: TRIP_ID });
  });
});
