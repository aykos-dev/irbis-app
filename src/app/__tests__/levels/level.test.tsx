import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  apiError,
  goOffline,
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
import { levelColors } from '../../../shared/constants/colors';
import { storage } from '../../../shared/storage';
import { levelsBody, myLevelBody } from '../../../features/levels/__tests__/harness';

let http: HttpStub;

const ME_LEVEL = '/v1/me/level';
const LEVELS = '/v1/levels';

/** Awaited navigation (the harness `navigate` is a sync act and leaks into the next test). */
async function go(open: () => void) {
  await act(() => {
    open();
  });
}

function styleOf(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

async function openLevelSignedIn() {
  http.reply('/v1/me', { status: 200, body: meBody() });
  await startSignedIn();
  await renderApp();
  await go(() => navigationRef.navigate('Level'));
  await screen.findByTestId('level.screen');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('levels — Level screen (AC5)', () => {
  it('AC5: signed in with a next level: frame, pill, name, since, bars and the next companion', async () => {
    http.reply(ME_LEVEL, { status: 200, body: myLevelBody() });
    await openLevelSignedIn();

    expect(await screen.findByTestId('level.name')).toHaveTextContent('Pathfinder');
    expect(screen.getByTestId('level.frame')).toBeOnTheScreen();
    expect(screen.getByTestId('level.pill')).toHaveTextContent('LEVEL 3');
    expect(screen.getByTestId('level.since')).toHaveTextContent('Fox · since August 2026');
    expect(screen.getByTestId('level.next')).toHaveTextContent(/To reach Level 4 · Ridge Walker/);
    expect(screen.getByTestId('level.req-xp-value')).toHaveTextContent('1,240 / 2,500');
    expect(styleOf('level.req-xp-bar').width).toBe('49.6%');
    expect(screen.getByTestId('level.req-lessons')).toHaveTextContent(/Tier 3 safety lessons.*4 \/ 6/);
    expect(screen.getByTestId('level.req-checkins')).toHaveTextContent(/difficulty 3\+.*5 \/ 8/);
    expect(screen.queryByTestId('level.req-spots')).not.toBeOnTheScreen();
    expect(screen.getByTestId('level.next-companion')).toHaveTextContent(/Next companion.*Ridge Walker · \?\?\?/);
    expect(styleOf('level.next-art').opacity).toBe(0.35);
    expect(screen.getByTestId('level.continue')).toBeOnTheScreen();
    expect(screen.queryByTestId('level.guest-cta')).not.toBeOnTheScreen();
    expect(qaEvents().filter(e => e.event === 'level_viewed')).toEqual([
      { event: 'level_viewed', level: 3, guest: false },
    ]);

    await fireEvent.press(screen.getByTestId('level.continue'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('Lessons');
  });

  it('AC5: level 7 shows the max card and spots only when required; bars cap at full', async () => {
    http.reply(ME_LEVEL, { status: 200, body: myLevelBody({ level: 7, next: null }) });
    await openLevelSignedIn();

    expect(await screen.findByTestId('level.max')).toHaveTextContent("You're a Snow Legend — the top level.");
    expect(screen.queryByTestId('level.next')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('level.next-companion')).not.toBeOnTheScreen();
    expect(screen.getByTestId('level.companions-link')).toBeOnTheScreen();
  });

  it('AC5: a next level with verified spots shows the spots row; an overfull bar stays at 100 %', async () => {
    const base = myLevelBody();
    http.reply(ME_LEVEL, {
      status: 200,
      body: myLevelBody({
        level: 6,
        next: { ...base.next, level: 7, xp: { current: 16000, required: 15000 }, verifiedSpots: { current: 1, required: 3 } },
      }),
    });
    await openLevelSignedIn();

    expect(await screen.findByTestId('level.req-spots')).toHaveTextContent(/Verified spots.*1 \/ 3/);
    expect(styleOf('level.req-xp-bar').width).toBe('100%');
  });

  it('AC5: a guest sees level 1, empty bars to level 2 and the sign-up card', async () => {
    http.reply(LEVELS, { status: 200, body: levelsBody });
    await renderApp();
    await go(() => navigationRef.navigate('Level'));

    expect(await screen.findByTestId('level.name')).toHaveTextContent('Wanderer');
    expect(screen.getByTestId('level.pill')).toHaveTextContent('LEVEL 1');
    expect(screen.queryByTestId('level.since')).not.toBeOnTheScreen();
    expect(screen.getByTestId('level.req-xp-value')).toHaveTextContent('0 / 300');
    expect(screen.getByTestId('level.req-lessons')).toHaveTextContent(/Safety lessons.*0 \/ 2/);
    expect(screen.getByTestId('level.guest-cta')).toBeOnTheScreen();
    expect(screen.queryByTestId('level.continue')).not.toBeOnTheScreen();
    expect(http.callsTo(ME_LEVEL)).toHaveLength(0);
    expect(qaEvents().filter(e => e.event === 'level_viewed')).toEqual([
      { event: 'level_viewed', level: 1, guest: true },
    ]);

    await fireEvent.press(screen.getByTestId('level.guest-signup'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('SignUp');
  });

  it('AC5: an error shows Try again, which reloads the level', async () => {
    http.reply(ME_LEVEL, apiError(500, 'INTERNAL'), { status: 200, body: myLevelBody() });
    await openLevelSignedIn();

    expect(await screen.findByTestId('level.error')).toHaveTextContent(/Couldn't load your level/);
    await fireEvent.press(screen.getByTestId('level.retry'));
    expect(await screen.findByTestId('level.name')).toHaveTextContent('Pathfinder');
  });

  it('AC5: offline shows the saved level with the banner, or the offline message without one', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(ME_LEVEL, { networkError: true });
    await startSignedIn();
    await renderApp();
    await openTab('profile');
    await screen.findByTestId('profile.username');
    await goOffline();
    await go(() => navigationRef.navigate('Level'));

    expect(await screen.findByTestId('level.offline')).toHaveTextContent(/You're offline — level not loaded/);

    await act(() => {
      navigationRef.goBack();
    });
    storage.setString('levels.lastMyLevel', JSON.stringify({ userId: meBody().id, data: myLevelBody({ level: 5 }) }));
    await go(() => navigationRef.navigate('Level'));

    expect(await screen.findByTestId('level.name')).toHaveTextContent('Mountain Guardian');
    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
  });
});

describe('levels — entry points (AC8)', () => {
  it('AC8: the Profile badge shows the level colour and opens Level', async () => {
    http.reply(ME_LEVEL, { status: 200, body: myLevelBody({ level: 4 }) });
    http.reply('/v1/me', { status: 200, body: meBody() });
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    await waitFor(() =>
      expect(StyleSheet.flatten(screen.getByTestId('profile.companion-badge').props.style).borderColor).toBe(
        levelColors[4].color,
      ),
    );

    await fireEvent.press(screen.getByTestId('profile.companion-badge'));
    expect(await screen.findByTestId('level.screen')).toBeOnTheScreen();
    expect(within(screen.getByTestId('level.pill')).getByText('LEVEL 4')).toBeOnTheScreen();
  });

  it('AC8: the guest Profile badge is level 1 and the place level card opens Level', async () => {
    http.reply(LEVELS, { status: 200, body: levelsBody });
    await renderApp();
    await openTab('profile');

    const badge = await screen.findByTestId('profile.companion-badge');
    expect(StyleSheet.flatten(badge.props.style).borderColor).toBe(levelColors[1].color);

    const id = '00000000-0000-4000-8000-0000000000a1';
    http.reply(`/v1/places/${id}`, {
      status: 200,
      body: {
        id,
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
      },
    });
    http.reply(`/v1/places/place-1/condition`, apiError(404, 'NOT_FOUND'));
    await go(() => navigationRef.navigate('Place', { id }));
    await fireEvent.press(await screen.findByTestId('place.level-card'));

    expect(await screen.findByTestId('level.screen')).toBeOnTheScreen();
  });
});
