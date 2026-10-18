import { cleanup, screen } from '@testing-library/react-native';

import {
  goOffline,
  openTab,
  qaEventNames,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { exploreFilters } from '../../../features/places/exploreFilters';

let http: HttpStub;

/** Synthetic place — not a real seed row. */
const item = {
  id: '00000000-0000-4000-8000-0000000000c1',
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3000,
  difficulty: 3,
  requiredLevel: 2,
  distanceM: 4249,
  conditionStatus: 'caution',
};

beforeEach(async () => {
  http = await setUpApp();
  exploreFilters.reset();
});
afterEach(async () => {
  await tearDownApp(http);
});

/** A killed app: the tree and the in-memory query cache are gone; only device storage stays. */
async function coldStartOffline() {
  await cleanup();
  exploreFilters.reset();
  await goOffline();
  await renderApp();
}

describe('conditions — Explore offline after a restart (AC8, Q11, D1)', () => {
  it('AC8 (Q11): offline after a restart, Explore shows the last loaded list with its status chip and origin', async () => {
    http.reply('/v1/places', {
      status: 200,
      body: { items: [item], nextCursor: null, origin: 'tashkent', total: 1 },
    });
    await renderApp();
    await openTab('explore');
    expect(await screen.findByTestId('explore.card.place-1.status')).toHaveTextContent('Caution');

    await coldStartOffline();
    await openTab('explore');

    expect(await screen.findByTestId('explore.card.place-1.status')).toHaveTextContent('Caution');
    expect(screen.getByTestId('explore.count')).toHaveTextContent('1 place from Tashkent');
    expect(screen.queryByTestId('explore.offline')).not.toBeOnTheScreen();
  });

  it('AC8: the saved list shown offline is not logged as a new load', async () => {
    http.reply('/v1/places', {
      status: 200,
      body: { items: [item], nextCursor: null, origin: 'tashkent', total: 1 },
    });
    await renderApp();
    await openTab('explore');
    await screen.findByTestId('explore.card.place-1.status');
    const loads = qaEventNames().filter(name => name === 'explore_loaded').length;

    await coldStartOffline();
    await openTab('explore');
    await screen.findByTestId('explore.card.place-1.status');

    expect(qaEventNames().filter(name => name === 'explore_loaded')).toHaveLength(loads);
  });
});
