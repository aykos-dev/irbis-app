import { act, fireEvent, screen } from '@testing-library/react-native';

import {
  goOffline,
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000a1';
const PLACE_URL = `/v1/places/${ID}`;
const CONDITION_URL = `${PLACE_URL}/condition`;

/** Synthetic place and condition — not real seed rows. */
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
  hazards: ['avalanche'],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: false },
};

const day = (name: 'sat' | 'sun', overrides: Record<string, unknown> = {}) => ({
  date: name === 'sat' ? '2026-10-24' : '2026-10-25',
  day: name,
  weatherCode: 0,
  tMaxC: 18.4,
  tMinC: 6.2,
  windKmh: 14,
  gustKmh: 25,
  precipMm: 0,
  precipProbPct: 10,
  snowCm: 0,
  ...overrides,
});

const conditionBody = {
  placeId: ID,
  status: 'caution',
  source: 'forecast',
  reasons: [{ code: 'WIND', day: 'sun', value: 45 }],
  text: null,
  opensMonth: null,
  hazards: [{ hazard: 'avalanche', level: 'raised' }],
  weekend: [day('sat'), day('sun', { weatherCode: 63, windKmh: 45, precipProbPct: 60 })],
  forecastAt: new Date().toISOString(),
  computedAt: new Date().toISOString(),
};

async function openPlace() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('Place', { id: ID });
  });
  await screen.findByTestId('place.name');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('conditions — Place condition, weather and hazards now (AC7, AC8)', () => {
  it('AC7: shows the condition, weekend weather and hazard levels, and logs condition_viewed once', async () => {
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    http.reply(CONDITION_URL, { status: 200, body: conditionBody });
    await openPlace();

    expect(await screen.findByTestId('place.condition-title')).toHaveTextContent('Caution this weekend');
    expect(screen.getByTestId('place.condition-updated')).toHaveTextContent('Updated just now · forecast');
    expect(screen.getByTestId('place.weather-day.sat')).toHaveTextContent('Sat 18° / 6°');
    expect(screen.getByTestId('place.weather-day.sun')).toHaveTextContent('Sun 18° / 6°');
    expect(screen.getByTestId('place.weather-summary')).toHaveTextContent('Wind 45 km/h · Rain 60%');
    expect(screen.getByTestId('place.weather')).toHaveTextContent(/Weather data by Open-Meteo\.com/);
    expect(screen.getByTestId('place.hazard.avalanche')).toHaveTextContent(/Avalanche.*Raised/);
    expect(screen.queryByTestId('place.hazards')).not.toBeOnTheScreen();
    expect(qaEvents().filter(e => e.event === 'condition_viewed')).toEqual([
      { event: 'condition_viewed', slug: 'place-1', status: 'caution', source: 'forecast', ageMin: 0 },
    ]);
  });

  it('AC8: a condition fetch error keeps the place and retries on "Try again"', async () => {
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    http.reply(CONDITION_URL, { networkError: true }, { status: 200, body: conditionBody });
    await openPlace();

    expect(await screen.findByTestId('place.condition-error')).toBeOnTheScreen();
    expect(screen.getByTestId('place.level-card')).toBeOnTheScreen();
    expect(screen.getByTestId('place.hazards')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('place.condition-retry'));
    expect(await screen.findByTestId('place.condition-title')).toHaveTextContent('Caution this weekend');
  });

  it('AC8: offline keeps the cached condition on screen', async () => {
    http.reply(PLACE_URL, { status: 200, body: placeBody });
    http.reply(CONDITION_URL, { status: 200, body: conditionBody });
    await openPlace();
    await screen.findByTestId('place.condition-title');
    await goOffline();

    expect(screen.getByTestId('place.condition-updated')).toHaveTextContent(/Updated/);
    expect(screen.queryByTestId('place.condition-offline')).not.toBeOnTheScreen();
  });
});

describe('conditions — Explore status chip (AC8)', () => {
  const item = (n: number, conditionStatus?: string | null) => ({
    id: `00000000-0000-4000-8000-0000000000b${n}`,
    slug: `place-${n}`,
    name: { uz: `Joy ${n}`, ru: null, en: `Place ${n}` },
    type: 'peak',
    latitude: 41.5,
    longitude: 70.1,
    elevationM: 3000,
    difficulty: 3,
    requiredLevel: 2,
    distanceM: 4249 * n,
    ...(conditionStatus === undefined ? {} : { conditionStatus }),
  });

  it('AC8: shows the chip only for places with a status and logs withStatus', async () => {
    const items = [item(1, 'not_now'), item(2, null), item(3)];
    http.reply('/v1/places', {
      status: 200,
      body: { items, nextCursor: null, origin: 'tashkent', total: items.length },
    });
    await renderApp();
    await openTab('explore');

    expect(await screen.findByTestId('explore.card.place-1.status')).toHaveTextContent('Not now');
    expect(screen.queryByTestId('explore.card.place-2.status')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('explore.card.place-3.status')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({
      event: 'explore_loaded',
      count: 3,
      origin: 'tashkent',
      withStatus: 1,
    });
  });
});
