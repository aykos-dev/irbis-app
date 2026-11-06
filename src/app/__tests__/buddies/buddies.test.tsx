import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import {
  apiError,
  meBody,
  openTab,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

let http: HttpStub;

/** Wednesday 2026-10-21 10:00 in Tashkent. */
const NOW = new Date('2026-10-21T05:00:00Z');
const ME_ID = '00000000-0000-4000-8000-000000000001';
const ANNA_ID = '00000000-0000-4000-8000-000000000002';
const BEK_ID = '00000000-0000-4000-8000-000000000003';
const LINK_ID = '00000000-0000-4000-8000-0000000000d1';
const TRIP_ID = '00000000-0000-4000-8000-0000000000b1';
const FIND_URL = '/v1/buddies/find';
const LIST_URL = '/v1/buddies';
const AVAILABILITY_URL = '/v1/me/availability';

/** Synthetic people only (guest_n). */
const candidate = (userId: string, username: string, overrides: Record<string, unknown> = {}) => ({
  userId,
  username,
  displayName: null,
  avatarUrl: null,
  level: 5,
  verifiedLeader: true,
  region: 'tashkent_region',
  interests: ['peaks', 'lakes'],
  rating: { mean: 4.9, raters: 4 },
  tripsTogether: 2,
  free: { sat: true, sun: false },
  ...overrides,
});

const link = (userId: string, username: string, id = LINK_ID, status = 'pending') => ({
  id,
  userId,
  username,
  displayName: null,
  avatarUrl: null,
  level: 3,
  status,
});

const page = (items: unknown[], nextCursor: string | null = null, matchCount = items.length) => ({
  status: 200,
  body: { items, nextCursor, matchCount },
});

const emptyList = { buddies: [], incoming: [], outgoing: [] };

async function signIn({ list = emptyList as unknown, trips = [] as unknown[] } = {}) {
  http.reply(
    '/v1/me',
    {
      status: 200,
      body: meBody({
        id: ME_ID,
        isDemo: false,
        level: 4,
        homeRegion: 'tashkent_region',
        interests: ['peaks', 'lakes', 'caves'],
        preferences: { appearance: 'auto', units: 'metric', showStats: true, showHomeRegion: true },
      }),
    },
  );
  http.reply(LIST_URL, { status: 200, body: list });
  http.reply('/v1/buddies/trips', { status: 200, body: { items: trips } });
  http.reply(AVAILABILITY_URL, { status: 200, body: { weekStart: '2026-10-19', sat: false, sun: false } });
  http.reply('/v1/me/buddy-summary', { status: 200, body: { buddyCount: 3, ratings: null } });
  await startSignedIn();
  await renderApp();
}

async function openBuddies(tab?: 'find' | 'mine') {
  await act(() => {
    navigationRef.navigate('Buddies', tab ? { tab } : undefined);
  });
  await screen.findByTestId('buddies.screen');
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('buddies — Find (AC1, AC2)', () => {
  it('AC1: shows the card with level, region, rating, trips together, leader, tags and free chip', async () => {
    http.reply(FIND_URL, page([candidate(ANNA_ID, 'guest_2')], null, 18));
    await signIn();
    await openBuddies();

    const card = await screen.findByTestId(`buddies.card-${ANNA_ID}`);
    expect(card).toHaveTextContent(/guest_2/);
    expect(card).toHaveTextContent(/Mountain Guardian · Tashkent region/);
    expect(card).toHaveTextContent(/★ 4\.9 · 2 trips together/);
    expect(within(card).getByText('Verified leader')).toBeOnTheScreen();
    expect(within(card).getByText('Peaks')).toBeOnTheScreen();
    expect(within(card).getByText('Free Sat')).toBeOnTheScreen();
    expect(screen.getByTestId('buddies.match-count')).toHaveTextContent('18 explorers match');
  });

  it('AC2: level, weekend, region and interest filters go into the query', async () => {
    http.reply(FIND_URL, page([]));
    await signIn();
    await openBuddies();
    expect(await screen.findByTestId('buddies.find-empty')).toHaveTextContent(/No explorers match/);
    expect(http.callsTo(FIND_URL)[0]?.params).toEqual({ level: 'any' });

    await fireEvent.press(screen.getByTestId('buddies.filter-level-near'));
    await fireEvent.press(screen.getByTestId('buddies.filter-weekend'));
    await fireEvent.press(screen.getByTestId('buddies.filter-region'));
    await fireEvent.press(screen.getByTestId('buddies.filter-interest-lakes'));
    await fireEvent.press(screen.getByTestId('buddies.filter-interest-peaks'));

    await waitFor(() =>
      expect(http.callsTo(FIND_URL).at(-1)?.params).toEqual({
        level: 'near',
        weekend: true,
        region: 'tashkent_region',
        interests: 'lakes,peaks',
      }),
    );
    expect(screen.getByTestId('buddies.filter-level-near')).toHaveTextContent('L3–L5');
  });

  it('loads the next page at the end of the list', async () => {
    http.handle(FIND_URL, config =>
      config.params?.cursor === 'next' ? page([candidate(BEK_ID, 'guest_3')]) : page([candidate(ANNA_ID, 'guest_2')], 'next'),
    );
    await signIn();
    await openBuddies();
    await screen.findByTestId(`buddies.card-${ANNA_ID}`);

    await fireEvent(screen.getByTestId('buddies.find-list'), 'onEndReached');

    expect(await screen.findByTestId(`buddies.card-${BEK_ID}`)).toBeOnTheScreen();
    expect(http.callsTo(FIND_URL).at(-1)?.params).toEqual({ level: 'any', cursor: 'next' });
  });
});

describe('buddies — availability (AC3)', () => {
  it('toggles Sat optimistically and rolls back when saving fails', async () => {
    http.reply(FIND_URL, page([]));
    await signIn();
    await openBuddies();
    const sat = await screen.findByTestId('buddies.free-sat');
    await waitFor(() => expect(sat).toBeEnabled());

    http.reply(AVAILABILITY_URL, { status: 200, body: { weekStart: '2026-10-19', sat: true, sun: false } });
    await fireEvent.press(sat);
    await waitFor(() => expect(screen.getByTestId('buddies.free-sat')).toBeSelected());
    const put = http.calls.find(call => call.url === AVAILABILITY_URL && call.method === 'put');
    expect(JSON.parse(String(put?.data))).toEqual({ sat: true, sun: false });

    http.reply(AVAILABILITY_URL, apiError(500, 'INTERNAL'));
    await fireEvent.press(screen.getByTestId('buddies.free-sun'));
    await waitFor(() => expect(screen.getByTestId('buddies.free-sun')).not.toBeSelected());
    expect(screen.getByTestId('buddies.free-sat')).toBeSelected();
  });
});

describe('buddies — requests (AC4)', () => {
  it('Add buddy sends the request and the card shows "Requested"', async () => {
    http.reply(FIND_URL, page([candidate(ANNA_ID, 'guest_2')]));
    await signIn();
    await openBuddies();
    http.reply('/v1/buddies/requests', { status: 201, body: link(ANNA_ID, 'guest_2') });

    await fireEvent.press(await screen.findByTestId(`buddies.add-${ANNA_ID}`));

    await waitFor(() => expect(screen.getByTestId(`buddies.add-${ANNA_ID}`)).toHaveTextContent('Requested'));
    expect(screen.getByTestId(`buddies.add-${ANNA_ID}`)).toBeDisabled();
    const post = http.calls.find(call => call.url === '/v1/buddies/requests');
    expect(JSON.parse(String(post?.data))).toEqual({ userId: ANNA_ID });
    expect(await screen.findByText('Buddy request sent')).toBeOnTheScreen();
  });

  it('accepts an incoming request from Mine; the badge counts it', async () => {
    await signIn({ list: { ...emptyList, incoming: [link(ANNA_ID, 'guest_2')] } });
    await openBuddies();
    http.reply(FIND_URL, page([]));
    expect(await screen.findByTestId('buddies.incoming-badge')).toHaveTextContent('1');

    await fireEvent.press(screen.getByTestId('buddies.mine'));
    http.reply(`/v1/buddies/requests/${LINK_ID}/accept`, { status: 200, body: link(ANNA_ID, 'guest_2', LINK_ID, 'accepted') });
    http.reply(LIST_URL, { status: 200, body: { ...emptyList, buddies: [link(ANNA_ID, 'guest_2', LINK_ID, 'accepted')] } });
    await fireEvent.press(await screen.findByTestId(`buddies.accept-${LINK_ID}`));

    expect(await screen.findByTestId(`buddies.remove-${ANNA_ID}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`buddies.accept-${LINK_ID}`)).not.toBeOnTheScreen();
    expect(screen.queryByTestId('buddies.incoming-badge')).not.toBeOnTheScreen();
  });

  it('removes a buddy after confirming', async () => {
    await signIn({ list: { ...emptyList, buddies: [link(ANNA_ID, 'guest_2', LINK_ID, 'accepted')] } });
    await openBuddies('mine');
    http.reply(`/v1/buddies/${ANNA_ID}`, { status: 204, body: '' });

    await fireEvent.press(await screen.findByTestId(`buddies.remove-${ANNA_ID}`));
    http.reply(LIST_URL, { status: 200, body: emptyList });
    await fireEvent.press(await screen.findByTestId('buddies.remove-sheet-confirm'));

    expect(await screen.findByTestId('buddies.mine-empty')).toBeOnTheScreen();
    expect(http.calls.filter(call => call.url === `/v1/buddies/${ANNA_ID}` && call.method === 'delete')).toHaveLength(1);
  });
});

describe('buddies — entry points (AC5)', () => {
  it('Profile "Buddies · 3" opens Mine', async () => {
    await signIn();
    await openTab('profile');
    const row = await screen.findByTestId('profile.buddies');
    await waitFor(() => expect(row).toHaveTextContent(/3 buddies/));

    await fireEvent.press(row);

    expect(await screen.findByTestId('buddies.mine-list')).toBeOnTheScreen();
    expect(screen.getByTestId('buddies.mine')).toBeSelected();
  });

  it('Groups "Find buddies" opens the Find tab', async () => {
    http.reply('/v1/groups', { status: 200, body: { yours: [], invitations: [], discover: [] } });
    http.reply('/v1/group-trips', { status: 200, body: { items: [], nextCursor: null } });
    http.reply(FIND_URL, page([]));
    await signIn();
    await openTab('community');
    await fireEvent.press(screen.getByTestId('community.segment.groups'));

    await fireEvent.press(await screen.findByTestId('groups.find-buddies'));

    expect(await screen.findByTestId('buddies.find-list')).toBeOnTheScreen();
  });
});

describe('buddies — Buddies are going (AC6)', () => {
  it('lists a buddy trip and opens the trip page', async () => {
    const trip = {
      id: TRIP_ID,
      placeName: { uz: 'Joy 1', ru: 'Место 1', en: 'Place 1' },
      startAt: '2026-10-24T00:30:00.000Z',
      approvedCount: 4,
      maxPeople: 10,
      buddies: [{ userId: ANNA_ID, username: 'guest_2', displayName: null }],
    };
    await signIn({ list: { ...emptyList, buddies: [link(ANNA_ID, 'guest_2', LINK_ID, 'accepted')] }, trips: [trip] });
    await openBuddies('mine');
    http.reply(`/v1/group-trips/${TRIP_ID}`, { status: 404, body: { statusCode: 404, code: 'GROUP_TRIP_NOT_FOUND', message: 'x', requestId: 'r' } });

    const row = await screen.findByTestId(`buddies.going-${TRIP_ID}`);
    expect(row).toHaveTextContent(/Place 1.*with guest_2/);
    await fireEvent.press(row);

    await waitFor(() => expect(http.callsTo(`/v1/group-trips/${TRIP_ID}`)).toHaveLength(1));
  });
});
