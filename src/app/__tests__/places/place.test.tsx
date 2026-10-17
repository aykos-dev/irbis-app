import { act, fireEvent, screen } from '@testing-library/react-native';

import {
  apiError,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { i18n } from '../../../shared/i18n';
import { tashkentMonth } from '../../../features/places/components/SeasonBar';
import { formatDistance } from '../../../features/places/formatDistance';

let http: HttpStub;

const ID = '00000000-0000-4000-8000-0000000000a1';
const URL = `/v1/places/${ID}`;

/** Synthetic place — not a real seed row. */
const placeBody = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  slug: 'place-1',
  name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
  type: 'peak',
  latitude: 41.5,
  longitude: 70.1,
  elevationM: 3309,
  difficulty: 3,
  requiredLevel: 4,
  distanceM: 4249,
  region: null,
  description: { uz: 'Birinchi.\n\nIkkinchi.', ru: null, en: null },
  season: [],
  hazards: [],
  origin: 'tashkent',
  viewer: { level: 1, qualifies: false },
  ...overrides,
});

async function navigate(params: { id: string; lat?: number; lng?: number }) {
  await act(() => {
    navigationRef.navigate('Place', params);
  });
}

async function openPlace(params: { id: string; lat?: number; lng?: number } = { id: ID }) {
  await renderApp();
  await navigate(params);
  await screen.findByTestId('place.screen');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('places — Place screen (AC7)', () => {
  it('AC7: falls back to the Uzbek name and shows distance from Tashkent with one decimal', async () => {
    i18n.locale = 'ru';
    http.reply(URL, { status: 200, body: placeBody() });
    await openPlace();

    expect(await screen.findByTestId('place.name')).toHaveTextContent('Joy 1');
    expect(screen.getByTestId('place.type')).toHaveTextContent('Пик');
    expect(screen.getByTestId('place.distance')).toHaveTextContent(/От Ташкента.*4,2 км/);
    expect(screen.getByTestId('place.difficulty')).toHaveTextContent('Сложность 3/5');
    expect(screen.getByTestId('place.description')).toHaveTextContent(/Birinchi\..*Ikkinchi\./);
    expect(http.callsTo(URL)[0]?.params).toBeUndefined();
    expect(qaEvents()).toContainEqual({
      event: 'place_viewed',
      slug: 'place-1',
      requiredLevel: 4,
      qualifies: false,
    });
  });

  it('AC7: passes device coords and shows whole km "From you"; no description when unset', async () => {
    http.reply(URL, {
      status: 200,
      body: placeBody({ origin: 'device', distanceM: 128_640, description: { uz: null, ru: null, en: null } }),
    });
    await openPlace({ id: ID, lat: 41.3, lng: 69.2 });

    expect(await screen.findByTestId('place.name')).toHaveTextContent('Place 1');
    expect(screen.getByTestId('place.distance')).toHaveTextContent(/From you.*129 km/);
    expect(screen.getByTestId('place.elevation')).toHaveTextContent(/Elevation.*3,309 m/);
    expect(screen.queryByTestId('place.description')).not.toBeOnTheScreen();
    expect(http.callsTo(URL)[0]?.params).toEqual({ lat: 41.3, lng: 69.2 });
  });

  it('AC7: shows the season bar for 12 months, hazards as chips', async () => {
    const season = ['closed', 'closed', 'possible', 'possible', 'best', 'best', 'best', 'best', 'possible', 'possible', 'closed', 'closed'];
    http.reply(URL, { status: 200, body: placeBody({ season, hazards: ['avalanche', 'road'] }) });
    await openPlace();

    expect(await screen.findByTestId('place.season')).toBeOnTheScreen();
    expect(screen.getByTestId('place.season-today')).toHaveTextContent(/^Today: \S+/);
    expect(screen.getByTestId('place.season-5')).toHaveProp('accessibilityLabel', 'M Best');
    expect(screen.queryByTestId('place.season-empty')).not.toBeOnTheScreen();
    expect(screen.getByTestId('place.hazards')).toHaveTextContent(/Avalanche.*Road/);
  });

  it('AC7: shows "not set yet" for an empty season and no hazards', async () => {
    http.reply(URL, { status: 200, body: placeBody() });
    await openPlace();

    expect(await screen.findByTestId('place.season-empty')).toHaveTextContent('Season not set yet');
    expect(screen.queryByTestId('place.season')).not.toBeOnTheScreen();
    expect(screen.getByTestId('place.hazards-empty')).toHaveTextContent('Hazards not set yet');
  });

  it('AC7: an unknown place shows "This place isn\'t available"; a failure offers retry', async () => {
    http.reply(URL, apiError(404, 'PLACE_NOT_FOUND'));
    await openPlace();
    expect(await screen.findByTestId('place.not-found')).toHaveTextContent(/This place isn't available/);

    http.reply(`/v1/places/other`, { networkError: true }, { status: 200, body: placeBody() });
    await navigate({ id: 'other' });
    await fireEvent.press(await screen.findByTestId('place.retry'));
    expect(await screen.findByTestId('place.name')).toBeOnTheScreen();
  });

  it('AC7: back returns to the previous screen', async () => {
    http.reply(URL, { status: 200, body: placeBody() });
    await openPlace();
    await fireEvent.press(await screen.findByTestId('place.back'));
    expect(screen.queryByTestId('place.screen')).not.toBeOnTheScreen();
  });

  it('AC7: formats distance in locale digits and reads the month in Tashkent', () => {
    expect(formatDistance(9_949, 'en')).toBe('9.9');
    expect(formatDistance(10_000, 'en')).toBe('10');
    expect(tashkentMonth(new Date('2026-01-31T20:00:00Z'))).toBe(1);
  });
});

describe('places — level card (AC8)', () => {
  it('AC8: a qualifying viewer sees "You qualify"', async () => {
    http.reply(URL, {
      status: 200,
      body: placeBody({ requiredLevel: 2, viewer: { level: 3, qualifies: true } }),
    });
    await openPlace();

    const card = await screen.findByTestId('place.level-card');
    expect(card).toHaveTextContent(/Requires.*Level 2 · Burrower.*or higher.*You qualify/);
    expect(screen.queryByTestId('place.level-locked')).not.toBeOnTheScreen();
  });

  it('AC8: a lower level sees the lock and "Reach Level n to go here"', async () => {
    http.reply(URL, { status: 200, body: placeBody() });
    await openPlace();

    expect(await screen.findByTestId('place.level-locked')).toHaveTextContent('Reach Level 4 to go here');
    expect(screen.getByTestId('place.level-card')).toHaveTextContent(/Level 4 · Ridge Walker/);
    expect(screen.queryByTestId('place.level-qualify')).not.toBeOnTheScreen();
  });
});
