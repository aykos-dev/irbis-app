import { act, screen } from '@testing-library/react-native';

import { renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { placeTypes } from '../../../features/places/placeTypes';
import { placeHeroes } from '../../../assets/images/places';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000b7';
const URL = `/v1/places/${ID}`;

/** Synthetic waterfall place — not a real seed row. */
const placeBody = {
  id: ID,
  slug: 'place-7',
  name: { uz: 'Joy 7', ru: null, en: 'Place 7' },
  type: 'waterfall',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 1800,
  difficulty: 2,
  requiredLevel: 1,
  distanceM: 5000,
  region: null,
  description: { uz: null, ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: true },
};

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('places — owner hero art (AC4, AC7)', () => {
  it('maps each of the 7 types to its own image and renders it on the waterfall hero', async () => {
    const sources = Object.values(placeTypes).map(info => info.hero);
    expect(sources).toHaveLength(7);
    expect(new Set(sources).size).toBe(7);

    http.reply(URL, { status: 200, body: placeBody });
    await renderApp();
    await act(() => {
      navigationRef.navigate('Place', { id: ID });
    });
    await screen.findByTestId('place.screen');

    const image = await screen.findByTestId('place.hero.image', { includeHiddenElements: true });
    expect(image).toHaveProp('source', placeHeroes.waterfall);
    expect(image).toHaveProp('resizeMode', 'cover');
    expect(image).toHaveProp('accessible', false);
  });
});
