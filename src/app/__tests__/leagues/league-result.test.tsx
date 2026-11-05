import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  meBody,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

let http: HttpStub;
const CURRENT = '/v1/leagues/current';
const SEEN = '/v1/me/league-result/seen';
const season = {
  key: '2026-autumn',
  name: 'Autumn 2026',
  startsAt: '2026-08-31T19:00:00.000Z',
  endsAt: '2026-11-30T19:00:00.000Z',
  settlesAt: '2026-12-02T19:00:00.000Z',
  status: 'active',
};
const ranked = (pendingResult: unknown = null) => ({
  season,
  ranked: true,
  tier: 'ranger',
  division: 1,
  rank: 2,
  elevationM: 1840,
  movement: { promote: 1, demote: 1, champion: false },
  standings: [
    {
      memberId: '00000000-0000-4000-8000-000000000101',
      rank: 1,
      elevationM: 2200,
      isMe: false,
      isPrivate: true,
      username: null,
      displayName: 'Explorer 1',
      avatarUrl: null,
      level: 5,
    },
    {
      memberId: '00000000-0000-4000-8000-000000000102',
      rank: 2,
      elevationM: 1840,
      isMe: true,
      isPrivate: false,
      username: 'guest_1',
      displayName: 'guest_1',
      avatarUrl: null,
      level: 4,
    },
  ],
  pendingResult,
});

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/me', { status: 200, body: meBody({ level: 4 }) });
  await startSignedIn();
});
afterEach(async () => tearDownApp(http));

it('renders a privacy-safe division and consumes a promotion result once', async () => {
  const result = {
    fromTier: 'tracker',
    toTier: 'ranger',
    outcome: 'promoted',
    medal: 'silver',
    rank: 2,
    elevationM: 1840,
    seasonName: 'Summer 2026',
  };
  http.reply(
    CURRENT,
    { status: 200, body: ranked(result) },
    { status: 200, body: ranked() },
  );
  http.reply(SEEN, { status: 200, body: { seen: true } });
  await renderApp();
  navigationRef.navigate('Leagues');

  expect(await screen.findByTestId('league.tier')).toBeOnTheScreen();
  expect(screen.getByTestId('league.promotion-zone')).toHaveTextContent(
    'Top 1 move up',
  );
  expect(
    screen.getByTestId('league.row.00000000-0000-4000-8000-000000000101'),
  ).toHaveTextContent(/Explorer 1/);
  expect(screen.getByTestId('league.result')).toHaveTextContent(/Promoted!/);

  await waitFor(
    () => expect(screen.getByTestId('league.result.done')).toBeEnabled(),
    { timeout: 2000 },
  );
  await fireEvent.press(screen.getByTestId('league.result.done'));
  await waitFor(() => expect(http.callsTo(SEEN)).toHaveLength(1));
  await waitFor(() => expect(screen.queryByTestId('league.result')).toBeNull());
});
