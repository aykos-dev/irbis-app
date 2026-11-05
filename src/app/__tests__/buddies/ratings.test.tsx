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
const PENDING_URL = `/v1/group-trips/${TRIP_ID}/ratings/pending`;
const RATE_ANNA_URL = `/v1/group-trips/${TRIP_ID}/ratings/${ANNA_ID}`;
const MY_PENDING_URL = '/v1/me/ratings/pending';

/** Synthetic people only (guest_n). */
const attendee = (userId: string, username: string, myScores: unknown = null) => ({
  userId,
  username,
  displayName: null,
  avatarUrl: null,
  level: 3,
  myScores,
});

const pendingBody = (closesAt = '2026-10-25T13:00:00Z') => ({
  groupTripId: TRIP_ID,
  closesAt,
  attendees: [attendee(ANNA_ID, 'guest_2'), attendee(BEK_ID, 'guest_3', { reliable: 4, safety: 5, company: 3 })],
});

const myPending = (unrated: number) => ({
  status: 200,
  body: {
    items: [
      {
        groupTripId: TRIP_ID,
        placeName: { uz: 'Chimyon', ru: 'Чимган', en: 'Chimgan' },
        startAt: '2026-10-17T01:00:00Z',
        closesAt: '2026-10-25T13:00:00Z',
        unrated,
      },
    ],
  },
});

const summary = (ratings: unknown) => ({ status: 200, body: { buddyCount: 2, ratings } });

async function signIn() {
  http.reply('/v1/me', { status: 200, body: meBody({ id: ME_ID, isDemo: false }) });
  await startSignedIn();
  await renderApp();
}

async function openRate() {
  await signIn();
  await act(() => {
    navigationRef.navigate('RateBuddies', { groupTripId: TRIP_ID });
  });
  await screen.findByTestId('rate.screen');
}

async function openPublicProfile(relation: string, linkId: string | null = null) {
  http.reply('/v1/users/guest_2', {
    status: 200,
    body: {
      username: 'guest_2',
      displayName: null,
      avatarUrl: null,
      bio: null,
      homeRegion: null,
      level: 3,
      createdAt: '2026-01-10T08:00:00Z',
      showStats: false,
    },
  });
  http.reply('/v1/users/guest_2/badges', { status: 200, body: { items: [] } });
  http.reply('/v1/users/guest_2/buddy-summary', summary(null));
  http.reply('/v1/users/guest_2/buddy-relation', { status: 200, body: { userId: ANNA_ID, relation, linkId } });
  await signIn();
  await act(() => {
    navigationRef.navigate('PublicProfile', { username: 'guest_2' });
  });
  await screen.findByTestId('public-profile.name');
}

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  jest.useRealTimers();
});

describe('buddies — rate trip buddies (AC7)', () => {
  it('AC7: Save unlocks after all three traits and PUTs the scores, then shows Saved', async () => {
    http.reply(PENDING_URL, { status: 200, body: pendingBody() });
    http.reply(RATE_ANNA_URL, { status: 204, body: undefined });
    await openRate();

    const card = await screen.findByTestId(`rate.card-${ANNA_ID}`);
    expect(card).toHaveTextContent(/guest_2/);
    expect(screen.getByTestId('rate.closes')).toHaveTextContent('Closes on October 25');
    expect(screen.getByText('Ratings are anonymous.')).toBeOnTheScreen();
    // Someone rated earlier starts as saved.
    expect(screen.getByTestId(`rate.save-${BEK_ID}`)).toHaveTextContent('Saved');

    const save = screen.getByTestId(`rate.save-${ANNA_ID}`);
    await fireEvent.press(screen.getByTestId(`rate.${ANNA_ID}-reliable-4`));
    await fireEvent.press(screen.getByTestId(`rate.${ANNA_ID}-safety-5`));
    expect(save).toBeDisabled();
    await fireEvent.press(screen.getByTestId(`rate.${ANNA_ID}-company-3`));
    expect(save).toBeEnabled();
    await fireEvent.press(save);

    await waitFor(() => expect(screen.getByTestId(`rate.save-${ANNA_ID}`)).toHaveTextContent('Saved'));
    const put = http.callsTo(RATE_ANNA_URL)[0];
    expect(put?.method).toBe('put');
    expect(JSON.parse(String(put?.data))).toEqual({ reliable: 4, safety: 5, company: 3 });
    expect(await screen.findByText('Rating saved')).toBeOnTheScreen();
  });

  it('AC7: after the close date the screen is read-only', async () => {
    http.reply(PENDING_URL, { status: 200, body: pendingBody('2026-10-20T13:00:00Z') });
    await openRate();
    expect(await screen.findByTestId('rate.closes')).toHaveTextContent('Rating closed on October 20.');
    expect(screen.queryByTestId(`rate.save-${ANNA_ID}`)).not.toBeOnTheScreen();
    expect(screen.getByTestId(`rate.${ANNA_ID}-reliable-1`)).toBeDisabled();
  });

  it('AC7: RATING_CLOSED on save shows the error and locks the screen', async () => {
    http.reply(PENDING_URL, { status: 200, body: pendingBody() });
    http.reply(RATE_ANNA_URL, apiError(409, 'RATING_CLOSED'));
    await openRate();
    await screen.findByTestId(`rate.card-${ANNA_ID}`);
    for (const trait of ['reliable', 'safety', 'company']) {
      await fireEvent.press(screen.getByTestId(`rate.${ANNA_ID}-${trait}-5`));
    }
    await fireEvent.press(screen.getByTestId(`rate.save-${ANNA_ID}`));
    expect(await screen.findByText('Rating for this trip has closed.')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId(`rate.save-${ANNA_ID}`)).not.toBeOnTheScreen());
  });

  it('AC7: the Home card opens the Rate screen and hides when nothing is pending', async () => {
    http.reply(MY_PENDING_URL, myPending(2));
    http.reply(PENDING_URL, { status: 200, body: pendingBody() });
    await signIn();
    const card = await screen.findByTestId('home.rate-card');
    expect(card).toHaveTextContent(/Rate your trip buddies · Chimgan/);
    expect(card).toHaveTextContent(/2 buddies to rate/);
    await fireEvent.press(within(card).getByTestId(`home.rate-card-${TRIP_ID}`));
    expect(await screen.findByTestId('rate.screen')).toBeOnTheScreen();
  });

  it('AC7: no Home card when every attendee is rated', async () => {
    http.reply(MY_PENDING_URL, myPending(0));
    await signIn();
    await waitFor(() => expect(http.callsTo(MY_PENDING_URL)).toHaveLength(1));
    expect(screen.queryByTestId('home.rate-card')).not.toBeOnTheScreen();
  });

  it('AC7: a trip_rate notification opens the Rate screen', async () => {
    http.reply('/v1/notifications', {
      status: 200,
      body: {
        items: [
          {
            id: 'n1',
            category: 'trips',
            kind: 'trip_rate',
            title: 'Rate your trip buddies',
            body: null,
            data: { groupTripId: TRIP_ID },
            readAt: null,
            createdAt: '2026-10-21T04:00:00Z',
          },
        ],
        unreadCount: 1,
        nextCursor: null,
      },
    });
    http.reply(PENDING_URL, { status: 200, body: pendingBody() });
    await signIn();
    await act(() => {
      navigationRef.navigate('Notifs');
    });
    await fireEvent.press(await screen.findByTestId('notifs.item-n1'));
    expect(await screen.findByTestId('rate.screen')).toBeOnTheScreen();
    expect(http.callsTo(PENDING_URL)).toHaveLength(1);
  });
});

describe('buddies — profile ratings (AC8)', () => {
  it('AC8: own profile shows averages with one decimal and rated trips', async () => {
    http.reply('/v1/me/buddy-summary', summary({ reliable: 4.25, safety: 4.8, company: 5, raters: 3, trips: 2 }));
    await signIn();
    await openTab('profile');
    const section = await screen.findByTestId('profile.ratings');
    expect(section).toHaveTextContent(/Rated by trip buddies/);
    await waitFor(() => expect(screen.getByTestId('profile.ratings-reliable')).toHaveTextContent(/Reliable.*4\.3/));
    expect(screen.getByTestId('profile.ratings-safety')).toHaveTextContent(/Safety-first.*4\.8/);
    expect(screen.getByTestId('profile.ratings-company')).toHaveTextContent(/Good company.*5\.0/);
    expect(screen.getByTestId('profile.ratings-trips')).toHaveTextContent('2 trips');
  });

  it('AC8: under three raters the public profile keeps the empty state', async () => {
    await openPublicProfile('none');
    expect(await screen.findByTestId('public-profile.ratings')).toHaveTextContent(/No buddy ratings yet\./);
    expect(screen.queryByTestId('public-profile.ratings-reliable')).not.toBeOnTheScreen();
  });
});

describe('buddies — public profile button from buddy-relation (AC5)', () => {
  it('AC5: none → Add buddy sends the request and turns into Requested', async () => {
    http.reply('/v1/buddies/requests', { status: 201, body: { id: LINK_ID, userId: ANNA_ID, status: 'pending' } });
    await openPublicProfile('none');
    http.reply('/v1/users/guest_2/buddy-relation', {
      status: 200,
      body: { userId: ANNA_ID, relation: 'outgoing', linkId: null },
    });
    await fireEvent.press(await screen.findByTestId('public-profile.add-buddy'));
    expect(JSON.parse(String(http.callsTo('/v1/buddies/requests')[0]?.data))).toEqual({ userId: ANNA_ID });
    expect(await screen.findByTestId('public-profile.buddy-status')).toHaveTextContent('Requested');
    expect(screen.getByTestId('public-profile.cancel-buddy')).toBeOnTheScreen();
  });

  it('AC5: incoming → Accept accepts the link; buddies → "Buddies"', async () => {
    http.reply(`/v1/buddies/requests/${LINK_ID}/accept`, { status: 201, body: { id: LINK_ID, userId: ANNA_ID, status: 'accepted' } });
    await openPublicProfile('incoming', LINK_ID);
    http.reply('/v1/users/guest_2/buddy-relation', {
      status: 200,
      body: { userId: ANNA_ID, relation: 'buddies', linkId: null },
    });
    await fireEvent.press(await screen.findByTestId('public-profile.accept-buddy'));
    expect(http.callsTo(`/v1/buddies/requests/${LINK_ID}/accept`)).toHaveLength(1);
    expect(await screen.findByTestId('public-profile.buddy-status')).toHaveTextContent('Buddies');
  });
});
