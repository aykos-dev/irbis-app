import Geolocation, { type GeolocationResponse } from '@react-native-community/geolocation';
import { act, fireEvent, screen } from '@testing-library/react-native';

import {
  meBody,
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { pathBody } from '../../../features/weekly-path/__tests__/harness';
import { catalogBody } from '../../../features/lessons/__tests__/harness';

let http: HttpStub;

const STREAKS = '/v1/me/streaks';
const PLACE_ID = '00000000-0000-4000-8000-0000000000c1';
const LAT = 41.5;
const LNG = 70.1;

/** Synthetic streaks — never a real account's. */
const streaksBody = (
  flame: Partial<{ count: number; doneToday: boolean; atRisk: boolean }> = {},
  boot: Partial<{ count: number; doneThisWeek: boolean; shieldedLastWeek: boolean }> = {},
) => ({
  today: '2026-10-30',
  flame: { count: 12, doneToday: true, atRisk: false, ...flame },
  boot: { count: 4, doneThisWeek: true, shieldedLastWeek: false, ...boot },
  freezes: { left: 1, perMonth: 2, usedThisMonth: [{ kind: 'flame', date: '2026-10-12' }] },
});

async function signedIn(...streaks: ReturnType<typeof streaksBody>[]) {
  http.reply('/v1/me', { status: 200, body: meBody({ level: 3, xpTotal: 120 }) });
  http.reply('/v1/path', { status: 200, body: pathBody() });
  http.reply(STREAKS, ...streaks.map(body => ({ status: 200, body })));
  await startSignedIn();
  await renderApp();
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('streaks — Path header and sheet (AC6)', () => {
  // First in the file: `streaks_seen` goes once per app session (module state).
  it('AC6: chips show flame + boot counts with the shield badge; tap opens the sheet', async () => {
    await signedIn(streaksBody({}, { shieldedLastWeek: true }));

    const flame = await screen.findByTestId('path.streak.flame');
    expect(flame).toHaveTextContent('12');
    expect(flame).toHaveProp('accessibilityLabel', '12-day streak');
    const boot = screen.getByTestId('path.streak.boot');
    expect(boot).toHaveTextContent('4');
    expect(boot).toHaveProp('accessibilityLabel', '4-week explorer streak, protected by weather shield');
    expect(screen.getByTestId('path.streak.shield')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'streaks_seen', flame: 12, boot: 4 });

    await fireEvent.press(flame);

    expect(await screen.findByTestId('streak.sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('streak.today')).toHaveTextContent('Today: done');
    expect(screen.getByTestId('streak.week')).toHaveTextContent('This week: checked in');
    expect(screen.getByTestId('streak.freezes')).toHaveTextContent('1 of 2 freezes left this month');
    expect(screen.getByTestId('streak.shield-line')).toHaveTextContent(
      'Bad-weather weekends never break your explorer streak.',
    );
    expect(screen.getByTestId('streak.mascot-excited')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'streak_sheet_open' });
  });

  it('AC6: at risk the sheet says "not yet" with sleepy Irbis, and no shield without a shielded week', async () => {
    await signedIn(streaksBody({ doneToday: false, atRisk: true }, { doneThisWeek: false }));

    await fireEvent.press(await screen.findByTestId('path.streak.boot'));

    expect(screen.queryByTestId('path.streak.shield')).toBeNull();
    expect(await screen.findByTestId('streak.today')).toHaveTextContent('Today: not yet');
    expect(screen.getByTestId('streak.week')).toHaveTextContent('This week: not yet');
    expect(screen.getByTestId('streak.mascot-sleepy')).toBeOnTheScreen();
  });

  it('AC6: a guest sees no streaks and never asks for them', async () => {
    http.reply('/v1/path', { status: 200, body: pathBody() });
    await renderApp();

    expect(await screen.findByTestId('path.node.1')).toBeOnTheScreen();
    expect(screen.queryByTestId('path.streak.flame')).toBeNull();
    expect(screen.queryByTestId('path.streak.boot')).toBeNull();
    expect(http.callsTo(STREAKS)).toHaveLength(0);
  });
});

describe('streaks — elsewhere (AC7)', () => {
  it('AC7: the Lessons hub shows the keep-your-streak line only when the flame is at risk', async () => {
    http.reply('/v1/lessons', { status: 200, body: catalogBody() });
    await signedIn(streaksBody({ doneToday: false, atRisk: true }));
    await screen.findByTestId('path.streak.flame');

    await openTab('lessons');

    expect(await screen.findByTestId('lessons.streak-line')).toHaveTextContent(
      'One more 3-minute lesson keeps your 12-day streak.',
    );
  });

  it('AC7: not at risk, no line on the Lessons hub; the account Profile shows the streak row', async () => {
    http.reply('/v1/lessons', { status: 200, body: catalogBody() });
    await signedIn(streaksBody());
    await screen.findByTestId('path.streak.flame');

    await openTab('lessons');
    await screen.findByTestId('lessons.hub');
    expect(screen.queryByTestId('lessons.streak-line')).toBeNull();

    await openTab('profile');
    expect(await screen.findByTestId('profile.streaks')).toHaveProp(
      'accessibilityLabel',
      'Streaks, 12 days · 4 weeks',
    );
  });

  it('AC7: after a sent check-in Summit shows the refetched week streak', async () => {
    const fix: GeolocationResponse = {
      coords: { latitude: LAT, longitude: LNG, accuracy: 12, altitude: 1900, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: Date.now(),
    };
    jest.mocked(Geolocation.requestAuthorization).mockImplementation(success => success?.());
    jest.mocked(Geolocation.getCurrentPosition).mockImplementation(success => success(fix));
    http.reply(`/v1/places/${PLACE_ID}`, {
      status: 200,
      body: {
        id: PLACE_ID,
        slug: 'place-1',
        name: { uz: 'Joy 1', ru: null, en: 'Place 1' },
        type: 'peak',
        latitude: LAT,
        longitude: LNG,
        elevationM: 1940,
        difficulty: 3,
        requiredLevel: 1,
        distanceM: 10,
        region: null,
        description: { uz: 'Birinchi.', ru: null, en: null },
        season: [],
        hazards: [],
        origin: 'tashkent',
        viewer: { level: 1, qualifies: true },
        checkInRadiusM: 300,
      },
    });
    http.reply('/v1/check-ins', {
      status: 201,
      body: {
        id: '00000000-0000-4000-8000-0000000000d1',
        placeId: PLACE_ID,
        recordedAt: '2026-10-30T05:00:00.000Z',
        counted: true,
        xp: 80,
        levelUps: [],
        pathVisited: false,
      },
    });
    await signedIn(streaksBody({}, { count: 4 }), streaksBody({}, { count: 5 }));
    await screen.findByTestId('path.streak.boot');
    await act(() => {
      navigationRef.navigate('Place', { id: PLACE_ID });
    });

    await fireEvent.press(await screen.findByTestId('checkin.button'));

    expect(await screen.findByTestId('summit.week-streak')).toHaveTextContent('5 Week streak');
    expect(http.callsTo(STREAKS).length).toBeGreaterThanOrEqual(2);
  });
});
