import { act, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { i18n } from '../../../shared/i18n';

let http: HttpStub;
let previousLocale: string;

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

async function openPlace() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('Place', { id: ID });
  });
  await screen.findByTestId('place.screen');
}

beforeEach(async () => {
  previousLocale = i18n.locale;
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
  i18n.locale = previousLocale;
});

describe('places — level card lock text (D3)', () => {
  it('D3: the uz lock line can shrink and wrap inside the card', async () => {
    i18n.locale = 'uz';
    http.reply(URL, { status: 200, body: placeBody });
    await openPlace();

    const text = await screen.findByText('Bu yerga borish uchun 2-darajaga yeting');
    const style = StyleSheet.flatten(text.props.style);
    expect(style.flexShrink ?? style.flex).toBeGreaterThanOrEqual(1);
    expect(text.props.numberOfLines ?? 0).toBe(0);
  });
});
