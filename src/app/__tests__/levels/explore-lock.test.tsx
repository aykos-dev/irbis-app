import { LocationManager } from '@maplibre/maplibre-react-native';
import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  meBody,
  openTab,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { exploreFilters } from '../../../features/places/exploreFilters';
import { myLevelBody } from '../../../features/levels/__tests__/harness';
import { levelColors } from '../../../shared/constants/colors';

let http: HttpStub;

/** Synthetic places — not real seed rows. */
const item = (n: number, requiredLevel: number) => ({
  id: `00000000-0000-4000-8000-0000000000d${n}`,
  slug: `place-${n}`,
  name: { uz: `Joy ${n}`, ru: null, en: `Place ${n}` },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3000,
  difficulty: 3,
  requiredLevel,
  distanceM: 1000 * n,
});

function replyPlaces(...levels: number[]) {
  const items = levels.map((level, index) => item(index + 1, level));
  http.reply('/v1/places', {
    status: 200,
    body: { items, nextCursor: null, origin: 'tashkent', total: items.length },
  });
}

beforeEach(async () => {
  http = await setUpApp();
  exploreFilters.reset();
  jest.mocked(LocationManager.requestPermissions).mockResolvedValue(false);
  jest.mocked(LocationManager.getCurrentPosition).mockResolvedValue(undefined);
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('levels — Explore lock chips (AC8)', () => {
  it('AC8: a guest (level 1) sees a "Level N" lock in the level colour above level 1 only', async () => {
    replyPlaces(1, 2);
    await renderApp();
    await openTab('explore');

    await screen.findByTestId('explore.card.place-2');
    expect(screen.queryByTestId('explore.card.place-1.lock')).not.toBeOnTheScreen();
    const lock = screen.getByTestId('explore.card.place-2.lock');
    expect(within(lock).getByText('Level 2')).toBeOnTheScreen();
    expect(StyleSheet.flatten(lock.props.style).borderColor).toBe(levelColors[2].color);
    expect(screen.getByTestId('explore.card.place-2').props.accessibilityLabel).toMatch(/Locked — needs Level 2/);
  });

  it('AC8: signed in at level 3, a level-3 place has no lock and a level-4 place has one', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply('/v1/me/level', { status: 200, body: myLevelBody({ level: 3 }) });
    replyPlaces(3, 4);
    await startSignedIn();
    await renderApp();
    await openTab('explore');

    expect(await screen.findByTestId('explore.card.place-2.lock')).toHaveTextContent('Level 4');
    expect(screen.queryByTestId('explore.card.place-1.lock')).not.toBeOnTheScreen();
  });
});
