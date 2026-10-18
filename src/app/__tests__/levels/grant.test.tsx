import { act, screen, waitFor } from '@testing-library/react-native';

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
import { linking } from '../../navigation/linking';
import { navigationRef } from '../../navigation/navigationRef';
import { myLevelBody } from '../../../features/levels/__tests__/harness';

let http: HttpStub;

const GRANT = '/v1/qa/levels/grant';

/** Opens a link the way the container does: parse the path, then reset to that state. */
async function openLink(path: string) {
  const state = linking.getStateFromPath?.(path, linking.config);
  expect(state?.routes[0]?.name).toBe('Debug');
  await act(() => {
    navigationRef.resetRoot(state);
  });
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('levels — QA grant link (AC8)', () => {
  it('AC8: signed in, the link posts the grant, refreshes the level and shows Granted', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply('/v1/me/level', { status: 200, body: myLevelBody() });
    http.reply(GRANT, { status: 200, body: myLevelBody() });
    await startSignedIn();
    await renderApp();
    await waitFor(() => expect(http.callsTo('/v1/me/level')).toHaveLength(1));

    await openLink('debug/levels/grant?xp=200&lessons=2&tier=3&checkins=1');

    expect(await screen.findByText('Granted')).toBeOnTheScreen();
    expect(JSON.parse(String(http.callsTo(GRANT)[0]?.data))).toEqual({
      xp: 200,
      lessons: [{ tier: '3' }, { tier: '3' }],
      checkIns: [{ difficulty: 1 }],
    });
    await waitFor(() => expect(http.callsTo('/v1/me/level')).toHaveLength(2));
    expect(qaEvents().filter(e => e.event === 'level_grant')).toEqual([
      { event: 'level_grant', xp: 200, lessons: 2, checkIns: 1, spots: 0, ok: true },
    ]);
  });

  it('AC8: a failed grant shows Grant failed and logs ok: false', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply('/v1/me/level', { status: 200, body: myLevelBody() });
    http.reply(GRANT, apiError(404, 'NOT_FOUND'));
    await startSignedIn();
    await renderApp();
    await openLink('debug/levels/grant?spots=1');

    expect(await screen.findByText('Grant failed')).toBeOnTheScreen();
    expect(qaEvents().filter(e => e.event === 'level_grant')).toEqual([
      { event: 'level_grant', xp: 0, lessons: 0, checkIns: 0, spots: 1, ok: false },
    ]);
  });

  it('AC8: signed out, the link opens the log-in prompt and posts nothing', async () => {
    await renderApp();
    await openLink('debug/levels/grant?xp=50');

    await waitFor(() => expect(qaEvents().map(e => e.event)).toContain('auth_gate_shown'));
    expect(http.callsTo(GRANT)).toHaveLength(0);
  });
});
