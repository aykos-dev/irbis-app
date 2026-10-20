import { fireEvent, screen } from '@testing-library/react-native';

import {
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
import { storage } from '../../../shared/storage';
import { completionsStore } from '../../../features/lessons/completionsStore';
import { heartsStore, tashkentDay } from '../../../features/lessons/heartsStore';
import { lessonCache } from '../../../features/lessons/lessonCache';
import { catalogBody, LESSON_IDS, lessonBody } from '../../../features/lessons/__tests__/harness';

let http: HttpStub;

const LESSONS = '/v1/lessons';
const LESSON = `/v1/lessons/${LESSON_IDS.compass}`;
const audio: { __started: jest.Mock } = jest.requireMock('react-native-audio-api');

/** Clip file names played so far, e.g. `lesson-correct`. */
function played(): string[] {
  return audio.__started.mock.calls.map(([source]: [{ testUri: string }]) =>
    source.testUri.replace(/^.*\/(lesson-[a-z]+)\.m4a$/, '$1'),
  );
}

function setHearts(hearts: number) {
  storage.setString('lessons.hearts', JSON.stringify({ day: tashkentDay(), hearts }));
}

async function openLesson() {
  await openTab('lessons');
  await fireEvent.press(await screen.findByTestId(`lessons.lesson.${LESSON_IDS.compass}`));
  await screen.findByTestId('quiz.screen');
}

async function pick(option: number) {
  await fireEvent.press(await screen.findByTestId(`quiz.option.${option}`));
  await fireEvent.press(screen.getByTestId('quiz.check'));
}

async function goOn() {
  await fireEvent.press(screen.getByTestId('quiz.continue'));
}

beforeEach(async () => {
  http = await setUpApp();
  audio.__started.mockClear();
  http.reply(LESSONS, { status: 200, body: catalogBody() });
  http.reply(LESSON, { status: 200, body: lessonBody() });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('lessons — quiz (AC5)', () => {
  it('AC5: right and wrong answers show their sheets, cost a heart, re-ask and record the run', async () => {
    await renderApp();
    await openLesson();

    expect(await screen.findByTestId('quiz.prompt')).toHaveTextContent('Where does the sun rise?');
    expect(screen.getByTestId('quiz.title')).toHaveTextContent('Finding north');
    expect(screen.getByTestId('quiz.hint')).toHaveTextContent('Think of the morning.');
    expect(screen.getByTestId('quiz.check')).toBeDisabled();

    await pick(1);
    const wrong = await screen.findByTestId('quiz.sheet.wrong');
    expect(wrong).toHaveTextContent(/Not quite — you lost a heart/);
    expect(wrong).toHaveTextContent(/Correct answer: East/);
    expect(wrong).toHaveTextContent(/West is where it sets\./);
    expect(screen.getByTestId('quiz.hearts')).toHaveTextContent('4');
    expect(heartsStore.hearts()).toBe(4);
    await goOn();

    expect(screen.getByTestId('quiz.prompt')).toHaveTextContent('Which star points north?');
    expect(screen.queryByTestId('quiz.hint')).toBeNull();
    await pick(1);
    expect(await screen.findByTestId('quiz.sheet.correct')).toHaveTextContent(/Nicely done!.*Polaris sits above/);
    await goOn();

    expect(screen.getByTestId('quiz.prompt')).toHaveTextContent('Where does the sun rise?');
    await pick(0);
    await goOn();

    expect(await screen.findByTestId('lesson.complete')).toBeOnTheScreen();
    expect(screen.getByTestId('lesson.complete.xp')).toHaveTextContent('+10 XP');
    expect(screen.getByTestId('lesson.complete.firstTry')).toHaveTextContent('Correct first try: 1 / 2');
    expect(screen.getByTestId('lesson.complete.hearts')).toHaveTextContent('Hearts left: 4');
    expect(played()).toEqual(['lesson-wrong', 'lesson-correct', 'lesson-correct', 'lesson-complete']);
    expect(completionsStore.all()).toEqual([
      expect.objectContaining({
        lessonId: LESSON_IDS.compass,
        perfect: false,
        synced: false,
        attempts: [
          { questionId: '00000000-0000-4000-8000-0000000000c1', optionIndex: 1 },
          { questionId: '00000000-0000-4000-8000-0000000000c2', optionIndex: 1 },
          { questionId: '00000000-0000-4000-8000-0000000000c1', optionIndex: 0 },
        ],
      }),
    ]);
    const answers = qaEvents().filter(e => e.event === 'lesson_answer');
    expect(answers.map(e => [e.correct, e.hearts, e.retry])).toEqual([
      [false, 4, false],
      [true, 4, false],
      [true, 4, true],
    ]);
    expect(qaEvents()).toContainEqual({
      event: 'lesson_completed',
      lessonId: LESSON_IDS.compass,
      practice: false,
      perfect: false,
      xp: 10,
    });

    await fireEvent.press(screen.getByTestId('lesson.complete.continue'));
    expect(await screen.findByTestId('lessons.hub')).toBeOnTheScreen();
    expect(screen.getByTestId('lessons.goal')).toHaveTextContent(/1\/3/);
  });

  it('AC7: a perfect run shows +xpPerfect and No hearts lost; muted plays nothing; a guest can sign up', async () => {
    storage.setString('lessons.muted', '1');
    await renderApp();
    await openLesson();
    expect(await screen.findByTestId('quiz.mute')).toHaveProp('accessibilityLabel', 'Sound on');

    await pick(0);
    await goOn();
    await pick(1);
    await goOn();

    const xp = await screen.findByTestId('lesson.complete.xp');
    expect(xp).toHaveTextContent(/\+5 XP.*No hearts lost!/);
    expect(played()).toEqual([]);
    await fireEvent.press(screen.getByTestId('lesson.complete.signup'));
    expect(await screen.findByTestId('auth.gate')).toBeOnTheScreen();
  });

  it('AC5: Close asks first, Quit goes back with nothing recorded; offline replays the cached lesson', async () => {
    await renderApp();
    await openLesson();
    await screen.findByTestId('quiz.prompt');
    await fireEvent.press(screen.getByTestId('quiz.close'));
    expect(await screen.findByTestId('quiz.quit')).toHaveTextContent(/Quit lesson\?.*Your progress in this lesson is lost\./);
    await fireEvent.press(screen.getByTestId('quiz.quit.confirm'));
    expect(await screen.findByTestId('lessons.hub')).toBeOnTheScreen();
    expect(completionsStore.all()).toEqual([]);
    expect(lessonCache.get(LESSON_IDS.compass)?.questions).toHaveLength(2);

    http.reply(LESSON, { networkError: true });
    await goOffline();
    await fireEvent.press(screen.getByTestId(`lessons.lesson.${LESSON_IDS.compass}`));
    expect(await screen.findByTestId('quiz.prompt')).toHaveTextContent('Where does the sun rise?');
  });

  it('AC5: offline without a cached copy asks for the internet', async () => {
    await renderApp();
    await openTab('lessons');
    const node = await screen.findByTestId(`lessons.lesson.${LESSON_IDS.compass}`);
    await goOffline();
    await fireEvent.press(node);
    expect(await screen.findByTestId('quiz.notCached')).toHaveTextContent(
      /Connect to the internet to open this lesson/,
    );
  });
});

describe('lessons — practice and hearts in the quiz (AC6)', () => {
  it('AC6: a done lesson is practice: no heart lost, "Not quite", no XP and nothing recorded', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(LESSONS, {
      status: 200,
      body: catalogBody({ progress: { completedLessonIds: [LESSON_IDS.compass], doneToday: 0 } }),
    });
    setHearts(0);
    await startSignedIn();
    await renderApp();
    await openLesson();

    expect(await screen.findByTestId('quiz.practice')).toHaveTextContent('Practice');
    expect(screen.queryByTestId('quiz.hearts')).toBeNull();
    await pick(2);
    const wrong = await screen.findByTestId('quiz.sheet.wrong');
    expect(wrong).toHaveTextContent(/^Not quiteCorrect answer/);
    expect(heartsStore.hearts()).toBe(0);
    await goOn();
    await pick(1);
    await goOn();
    await pick(0);
    await goOn();

    expect(await screen.findByTestId('lesson.complete.xp')).toHaveTextContent('Practice — no XP');
    expect(screen.queryByTestId('lesson.complete.signup')).toBeNull();
    expect(completionsStore.all()).toEqual([]);
  });

  it('AC6: the last heart lost in a new lesson opens out-of-hearts, then the hub; nothing recorded', async () => {
    setHearts(1);
    await renderApp();
    await openLesson();

    await pick(3);
    await goOn();
    expect(await screen.findByTestId('quiz.outofhearts')).toHaveTextContent(/Out of hearts/);
    await fireEvent.press(screen.getByTestId('quiz.outofhearts.ok'));
    expect(await screen.findByTestId('lessons.hub')).toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()?.name).toBe('Lessons');
    expect(completionsStore.all()).toEqual([]);
    expect(qaEvents()).toContainEqual({ event: 'lesson_failed', lessonId: LESSON_IDS.compass });
  });
});
