import { fireEvent, screen } from '@testing-library/react-native';

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
const season = {
  key: '2026-autumn',
  name: 'Autumn 2026',
  startsAt: '2026-08-31T19:00:00.000Z',
  endsAt: '2026-11-30T19:00:00.000Z',
  settlesAt: '2026-12-02T19:00:00.000Z',
  status: 'active',
};

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/me', { status: 200, body: meBody({ level: 4 }) });
  await startSignedIn();
});
afterEach(async () => tearDownApp(http));

it('shows an honest unranked season before the first qualifying tracked trip', async () => {
  http.reply(CURRENT, {
    status: 200,
    body: {
      season,
      ranked: false,
      tier: null,
      division: null,
      rank: null,
      elevationM: 0,
      standings: [],
      movement: null,
      pendingResult: null,
    },
  });
  await renderApp();
  navigationRef.navigate('Leagues');

  expect(await screen.findByTestId('league.screen')).toHaveTextContent(
    /Unranked/,
  );
  expect(screen.getByTestId('league.join-note')).toHaveTextContent(
    /first tracked adventure/,
  );
  expect(screen.queryByTestId('league.promotion-zone')).toBeNull();
  await fireEvent.press(screen.getByTestId('league.back'));
  await screen.findByTestId('nav.tab-profile');
});
