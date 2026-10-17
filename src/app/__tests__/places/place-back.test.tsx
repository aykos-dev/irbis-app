import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderApp, setUpApp, tearDownApp, apiError, type HttpStub } from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000a1';
const URL = `/v1/places/${ID}`;

/** Synthetic place — not a real seed row. */
const placeBody = {
  id: ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3309,
  difficulty: 3,
  requiredLevel: 2,
  distanceM: 4249,
  region: null,
  description: { uz: null, ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: false },
};

/** A cold deep link: Place is the only route in the root stack. */
async function openColdDeepLink() {
  await renderApp();
  await act(() => {
    navigationRef.reset({ index: 0, routes: [{ name: 'Place', params: { id: ID } }] });
  });
  await screen.findByTestId('place.screen');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('places — back after a cold deep link (D2)', () => {
  it('D2: back on "This place isn\'t available" goes to the Explore tab', async () => {
    http.reply(URL, apiError(404, 'PLACE_NOT_FOUND'));
    await openColdDeepLink();
    await fireEvent.press(await screen.findByTestId('place.not-found-back'));

    expect(screen.queryByTestId('place.screen')).not.toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Explore');
  });

  it('D2: the header back on a valid place goes to the Explore tab', async () => {
    http.reply(URL, { status: 200, body: placeBody });
    await openColdDeepLink();
    await screen.findByTestId('place.name');
    await fireEvent.press(screen.getByTestId('place.back'));

    expect(screen.queryByTestId('place.screen')).not.toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Explore');
  });
});
