import { act, fireEvent, screen, within } from '@testing-library/react-native';

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
import { linking } from '../../navigation/linking';
import { navigationRef } from '../../navigation/navigationRef';
import { storage } from '../../../shared/storage';
import { catalogStore } from '../../../features/lessons/catalogStore';
import { heartsStore, tashkentDay } from '../../../features/lessons/heartsStore';
import { catalogBody, LESSON_IDS } from '../../../features/lessons/__tests__/harness';

let http: HttpStub;

const LESSONS = '/v1/lessons';

async function openHub() {
  await openTab('lessons');
  await screen.findByTestId('lessons.hub');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('lessons — hub (AC4)', () => {
  it('AC4: signed in, tiers show done counts, START on the first not-done lesson and the daily goal', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(LESSONS, {
      status: 200,
      body: catalogBody({ progress: { completedLessonIds: [LESSON_IDS.compass], doneToday: 1 } }),
    });
    await startSignedIn();
    await renderApp();
    await openHub();

    const tier1 = await screen.findByTestId('lessons.tier.1');
    expect(tier1).toHaveTextContent(/Tier 1.*Basics.*1 \/ 3/);
    expect(screen.getByTestId('lessons.tier.first-aid')).toHaveTextContent(/First aid.*Injuries.*0 \/ 1/);
    expect(within(screen.getByTestId(`lessons.lesson.${LESSON_IDS.leaf}`)).getByTestId('lessons.start')).toHaveTextContent(
      'START',
    );
    expect(screen.getAllByTestId('lessons.start')).toHaveLength(1);
    expect(screen.getByTestId('lessons.goal')).toHaveTextContent(/1\/3.*2 more lessons to reach today's goal/);
    expect(screen.getByTestId('lessons.hearts')).toHaveTextContent('5');
    expect(catalogStore.snapshot(meBody().id)?.tiers).toHaveLength(2);

    await fireEvent.press(screen.getByTestId(`lessons.lesson.${LESSON_IDS.padlock}`));
    expect(await screen.findByTestId('quiz.title')).toHaveTextContent('Trip plan');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ lessonId: LESSON_IDS.padlock });
  });

  it('AC4: no tiers shows the empty state; an error shows Try again, which reloads', async () => {
    http.reply(LESSONS, apiError(500, 'INTERNAL'), { status: 200, body: catalogBody({ tiers: [] }) });
    await renderApp();
    await openHub();

    expect(await screen.findByText("Couldn't load lessons")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('lessons.error.retry'));
    expect(await screen.findByTestId('lessons.empty')).toHaveTextContent('Lessons are on their way');
  });

  it('AC4: offline shows the saved catalog with the banner, or the offline message without one', async () => {
    await renderApp();
    await goOffline();
    await openHub();
    expect(await screen.findByTestId('lessons.offline')).toHaveTextContent(/You're offline/);
    expect(http.callsTo(LESSONS)).toHaveLength(0);
  });

  it('AC4: offline with a saved catalog shows its tiers and the offline banner', async () => {
    catalogStore.save(catalogBody(), null);
    await renderApp();
    await goOffline();
    await openHub();

    expect(await screen.findByTestId('lessons.tier.1')).toHaveTextContent(/0 \/ 3/);
    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('lessons.goal')).toHaveTextContent(/0\/3/);
  });
});

describe('lessons — daily hearts (AC6)', () => {
  it('AC6: a new Tashkent day resets hearts to heartsPerDay and logs hearts_reset', async () => {
    storage.setString('lessons.hearts', JSON.stringify({ day: '2000-01-01', hearts: 0 }));
    http.reply(LESSONS, { status: 200, body: catalogBody() });
    await renderApp();
    await openHub();

    expect(screen.getByTestId('lessons.hearts')).toHaveTextContent('5');
    expect(JSON.parse(storage.getString('lessons.hearts') ?? '')).toEqual({ day: tashkentDay(), hearts: 5 });
    expect(qaEvents().filter(e => e.event === 'hearts_reset')).toEqual([{ event: 'hearts_reset', hearts: 5 }]);
  });

  it('AC6: with 0 hearts a not-done lesson opens the out-of-hearts sheet; a done lesson still opens', async () => {
    storage.setString('lessons.hearts', JSON.stringify({ day: tashkentDay(), hearts: 0 }));
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(LESSONS, {
      status: 200,
      body: catalogBody({ progress: { completedLessonIds: [LESSON_IDS.compass], doneToday: 0 } }),
    });
    await startSignedIn();
    await renderApp();
    await openHub();

    expect(await screen.findByTestId('lessons.hearts')).toHaveTextContent('0');
    await fireEvent.press(await screen.findByTestId(`lessons.lesson.${LESSON_IDS.leaf}`));
    const sheet = await screen.findByTestId('quiz.outofhearts');
    expect(sheet).toHaveTextContent(/Out of hearts — back at midnight/);
    expect(sheet).toHaveTextContent(/New hearts in \d\d:\d\d\./);
    expect(navigationRef.getCurrentRoute()?.name).toBe('Lessons');

    await fireEvent.press(screen.getByText('OK'));
    await fireEvent.press(screen.getByTestId(`lessons.lesson.${LESSON_IDS.compass}`));
    expect(await screen.findByTestId('quiz.title')).toHaveTextContent('Finding north');
  });

  it('AC6: the debug link sets today hearts and opens Debug', async () => {
    await renderApp();
    const state = linking.getStateFromPath?.('debug/lessons/hearts/2', linking.config);
    expect(state?.routes[0]?.name).toBe('Debug');
    await act(() => {
      navigationRef.resetRoot(state);
    });
    expect(heartsStore.hearts()).toBe(2);
    expect(heartsStore.loseHeart()).toBe(1);
    expect(heartsStore.loseHeart()).toBe(0);
    expect(heartsStore.loseHeart()).toBe(0);
  });
});
