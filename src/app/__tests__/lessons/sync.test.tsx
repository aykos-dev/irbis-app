import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { completionsStore, type LocalCompletion } from '../../../features/lessons/completionsStore';
import { LESSON_IDS } from '../../../features/lessons/__tests__/harness';
import { storage } from '../../../shared/storage';
import {
  apiError,
  gate,
  goOffline,
  meBody,
  openTab,
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';

let http: HttpStub;

const COMPLETE = '/v1/me/lesson-completions';
const MERGE = '/v1/me/guest-merge';
const ME_LEVEL = '/v1/me/level';

/** A synthetic local completion; `minute` orders them. */
const local = (lessonId: string, minute: number, synced = false): LocalCompletion => ({
  lessonId,
  completedAt: `2026-10-19T08:${String(minute).padStart(2, '0')}:00.000Z`,
  attempts: [{ questionId: '00000000-0000-4000-8000-0000000000c1', optionIndex: 0 }],
  perfect: true,
  synced,
});

function seed(...completions: LocalCompletion[]) {
  storage.setString('lessons.completions', JSON.stringify(completions));
}

const sentIds = () => http.callsTo(COMPLETE).map(call => JSON.parse(String(call.data)).lessonId);
const syncEvents = () => qaEvents().filter(entry => entry.event === 'lesson_sync');
const accepted = { status: 201, body: { xpAwarded: 10, firstCompletion: true, levelUps: [] } };

async function startWithQueue(...completions: LocalCompletion[]) {
  seed(...completions);
  http.reply('/v1/me', { status: 200, body: meBody() });
  await startSignedIn();
  await renderApp();
}

beforeEach(async () => {
  http = await setUpApp();
  http.reply(ME_LEVEL, apiError(503, 'UNAVAILABLE'));
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('lessons — completion sync (AC7)', () => {
  it('AC7: at app start sends every queued completion oldest first, marks them synced and refreshes the level', async () => {
    http.reply(COMPLETE, accepted);
    await startWithQueue(local(LESSON_IDS.leaf, 30), local(LESSON_IDS.compass, 10), local(LESSON_IDS.padlock, 5, true));

    await waitFor(() => expect(syncEvents()).toEqual([{ event: 'lesson_sync', sent: 2, queued: 0 }]));
    expect(sentIds()).toEqual([LESSON_IDS.compass, LESSON_IDS.leaf]);
    expect(JSON.parse(String(http.callsTo(COMPLETE)[0]?.data))).toEqual({
      lessonId: LESSON_IDS.compass,
      completedAt: '2026-10-19T08:10:00.000Z',
      attempts: [{ questionId: '00000000-0000-4000-8000-0000000000c1', optionIndex: 0 }],
    });
    expect(completionsStore.unsynced()).toEqual([]);
    await waitFor(() => expect(http.callsTo(ME_LEVEL).length).toBeGreaterThanOrEqual(2));
  });

  it('AC7: a 400 is dropped for good and logged without user data; the rest still goes', async () => {
    http.reply(COMPLETE, apiError(400, 'VALIDATION_FAILED'), accepted);
    await startWithQueue(local(LESSON_IDS.compass, 10), local(LESSON_IDS.leaf, 20));

    await waitFor(() => expect(syncEvents()).toEqual([{ event: 'lesson_sync', sent: 1, queued: 0 }]));
    expect(qaEvents()).toContainEqual({ event: 'lesson_sync_dropped', code: 'VALIDATION_FAILED', requestId: 'req_1' });
    expect(completionsStore.all().find(entry => entry.lessonId === LESSON_IDS.compass)).toMatchObject({
      synced: true,
      dropped: true,
    });

    await goOffline();
    await act(() => {
      onlineManager.setOnline(true);
    });
    expect(sentIds()).toEqual([LESSON_IDS.compass, LESSON_IDS.leaf]);
  });

  it('AC7: offline or 5xx keeps the queue; the network coming back sends it', async () => {
    http.reply(COMPLETE, { networkError: true }, apiError(503, 'UNAVAILABLE'), accepted);
    await startWithQueue(local(LESSON_IDS.compass, 10), local(LESSON_IDS.leaf, 20));

    await waitFor(() => expect(syncEvents()).toEqual([{ event: 'lesson_sync', sent: 0, queued: 2 }]));
    expect(sentIds()).toEqual([LESSON_IDS.compass]);

    await goOffline();
    await act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(syncEvents()).toHaveLength(2));
    expect(completionsStore.unsynced()).toHaveLength(2);

    await goOffline();
    await act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(syncEvents().at(-1)).toEqual({ event: 'lesson_sync', sent: 2, queued: 0 }));
    expect(sentIds()).toEqual([LESSON_IDS.compass, LESSON_IDS.compass, LESSON_IDS.compass, LESSON_IDS.leaf]);
  });

  it('AC7: never two flushes at once; a completion during a flush goes right after it', async () => {
    const held = gate();
    http.reply(COMPLETE, { hold: held.promise, reply: accepted }, accepted);
    await startWithQueue(local(LESSON_IDS.compass, 10));
    await waitFor(() => expect(http.callsTo(COMPLETE)).toHaveLength(1));

    await act(async () => {
      completionsStore.add(local(LESSON_IDS.leaf, 20));
    });
    await goOffline();
    await act(() => {
      onlineManager.setOnline(true);
    });
    expect(http.callsTo(COMPLETE)).toHaveLength(1);

    await act(async () => {
      held.open();
    });
    await waitFor(() => expect(completionsStore.unsynced()).toEqual([]));
    expect(sentIds()).toEqual([LESSON_IDS.compass, LESSON_IDS.leaf]);
  });
});

describe('lessons — guest completions (AC7)', () => {
  beforeEach(() => {
    http.reply('/v1/auth/log-in', { status: 200, body: sessionBody() });
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(COMPLETE, accepted);
  });

  async function logIn() {
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.guest-login'));
    await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('profile.username');
  }

  it('AC7: the first log-in merges the unsynced guest completions and marks them synced', async () => {
    http.reply(MERGE, { status: 200, body: { merged: ['locale', 'lessons'], skipped: [] } });
    seed(local(LESSON_IDS.leaf, 20), local(LESSON_IDS.padlock, 5, true), local(LESSON_IDS.compass, 10));
    await renderApp();

    await logIn();

    expect(JSON.parse(String(http.callsTo(MERGE)[0]?.data)).lessons).toEqual({
      completions: [
        { lessonId: LESSON_IDS.compass, completedAt: '2026-10-19T08:10:00.000Z', attempts: expect.any(Array) },
        { lessonId: LESSON_IDS.leaf, completedAt: '2026-10-19T08:20:00.000Z', attempts: expect.any(Array) },
      ],
    });
    await waitFor(() => expect(completionsStore.unsynced()).toEqual([]));
    expect(http.callsTo(COMPLETE)).toHaveLength(0);
  });

  it('AC7: a guest completion after the one-time merge goes by the flush right after log-in', async () => {
    storage.setString('guest.merged', '1');
    seed(local(LESSON_IDS.compass, 10));
    await renderApp();

    await logIn();

    await waitFor(() => expect(sentIds()).toEqual([LESSON_IDS.compass]));
    expect(http.callsTo(MERGE)).toHaveLength(0);
    await waitFor(() => expect(completionsStore.unsynced()).toEqual([]));
  });
});
