import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import {
  apiError,
  meBody,
  qaEvents,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { myLevelBody } from '../../../features/levels/__tests__/harness';

let http: HttpStub;

const ME_LEVEL = '/v1/me/level';
const seenUrl = (id: string) => `/v1/me/level-ups/${id}/seen`;

/** Synthetic pending level-ups (API order: oldest first). */
const up = (n: number, from: number, to: number, overrides: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-0000000000c${n}`,
  fromLevel: from,
  toLevel: to,
  maxDifficulty: Math.min(to, 5),
  newPlacesCount: 4,
  ...overrides,
});

async function advance(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

async function startWith(...bodies: ReturnType<typeof myLevelBody>[]) {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply(ME_LEVEL, ...bodies.map(body => ({ status: 200, body })));
  await startSignedIn();
  await renderApp();
}

/** Plays the 3 s sequence out, so the end state (title, card, buttons) shows. */
async function playOut() {
  await screen.findByTestId('levelup.sequence');
  await advance(3000);
  return screen.findByTestId('levelup.continue');
}

function events(name: string) {
  return qaEvents().filter(entry => entry.event === name);
}

beforeEach(async () => {
  http = await setUpApp();
  jest.useFakeTimers();
});
afterEach(async () => {
  jest.useRealTimers();
  await tearDownApp(http);
});

describe('levels — LevelUp queue (AC7)', () => {
  it('AC7: opens the oldest pending level-up; Continue sends seen, then opens the next, then closes', async () => {
    const first = up(1, 2, 3);
    const second = up(2, 3, 4);
    await startWith(myLevelBody({ level: 4, pendingLevelUps: [first, second] }), myLevelBody({ level: 4 }));
    http.reply(seenUrl(first.id), { status: 204, body: null });
    http.reply(seenUrl(second.id), { status: 204, body: null });

    expect(await screen.findByTestId('levelup.screen')).toBeOnTheScreen();
    expect(events('levelup_shown')).toEqual([{ event: 'levelup_shown', from: 2, to: 3 }]);
    await playOut();
    expect(screen.getByTestId('levelup.title')).toHaveTextContent("You're a Pathfinder");
    expect(screen.getByTestId('levelup.places')).toHaveTextContent('Difficulty 3 and overnight trips · 4 new places');

    await fireEvent.press(screen.getByTestId('levelup.continue'));
    await waitFor(() => expect(events('levelup_shown')).toHaveLength(2));
    expect(http.callsTo(seenUrl(first.id))).toHaveLength(1);
    expect(http.callsTo(seenUrl(second.id))).toHaveLength(0);
    expect(events('levelup_shown')[1]).toEqual({ event: 'levelup_shown', from: 3, to: 4 });
    await playOut();
    expect(screen.getByTestId('levelup.title')).toHaveTextContent("You're a Ridge Walker");

    await fireEvent.press(screen.getByTestId('levelup.continue'));
    await waitFor(() => expect(navigationRef.getCurrentRoute()?.name).not.toBe('LevelUp'));
    expect(http.callsTo(seenUrl(second.id))).toHaveLength(1);
    expect(events('levelup_continue')).toEqual([
      { event: 'levelup_continue', to: 3 },
      { event: 'levelup_continue', to: 4 },
    ]);
  });

  it('AC7: a level-up whose seen failed is never shown twice this session; seen is retried on refetch', async () => {
    const only = up(1, 1, 2, { newPlacesCount: 0 });
    await startWith(myLevelBody({ level: 2, pendingLevelUps: [only] }));
    http.reply(seenUrl(only.id), apiError(500, 'INTERNAL'));

    await screen.findByTestId('levelup.screen');
    await playOut();
    expect(screen.getByTestId('levelup.places')).toHaveTextContent(/^Difficulty 2 places$/);

    await fireEvent.press(screen.getByTestId('levelup.continue'));
    await waitFor(() => expect(http.callsTo(ME_LEVEL).length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(http.callsTo(seenUrl(only.id)).length).toBeGreaterThanOrEqual(2));
    expect(navigationRef.getCurrentRoute()?.name).not.toBe('LevelUp');
    expect(events('levelup_shown')).toHaveLength(1);
  });

  it('AC7: a tap skips only after 1 s; Share sends the share text', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await startWith(myLevelBody({ level: 4, pendingLevelUps: [up(1, 3, 4)] }));
    await screen.findByTestId('levelup.sequence');

    await advance(500);
    await fireEvent.press(screen.getByTestId('levelup.sequence'));
    expect(screen.queryByTestId('levelup.continue')).not.toBeOnTheScreen();
    expect(events('levelup_skipped')).toHaveLength(0);

    await advance(700);
    await fireEvent.press(screen.getByTestId('levelup.sequence'));
    expect(await screen.findByTestId('levelup.continue')).toBeOnTheScreen();
    const skipped = events('levelup_skipped');
    expect(skipped).toEqual([{ event: 'levelup_skipped', to: 4, atMs: expect.any(Number) }]);
    expect(skipped[0]?.atMs).toBeGreaterThanOrEqual(1200);
    expect(skipped[0]?.atMs).toBeLessThan(3000);

    await fireEvent.press(screen.getByTestId('levelup.share'));
    expect(share).toHaveBeenCalledWith({ message: "I'm now a Ridge Walker on Irbis!" });
    expect(events('levelup_share')).toEqual([{ event: 'levelup_share', to: 4 }]);
    share.mockRestore();
  });
});
