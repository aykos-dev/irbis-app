import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

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
import { pathBody, pathNode, PLACE_IDS } from '../../../features/weekly-path/__tests__/harness';

let http: HttpStub;

const PATH = '/v1/path';
const OPEN = '/v1/path/chest/open';
const VISIT = '/v1/qa/path/visits';

const swap = {
  place: {
    id: PLACE_IDS.trail,
    slug: 'long-trail',
    name: { uz: 'Long Trail uz', ru: 'Long Trail ru', en: 'Long Trail' },
    type: 'trail',
    difficulty: 1,
    requiredLevel: 1,
    elevationM: 2600,
  },
  status: 'go',
  day: 'sun',
  distanceFromOriginalKm: 12.5,
  elevationDiffM: 1100,
};

const swapPath = () =>
  pathBody({
    nodes: [pathNode(1, { status: 'not_now', swap }), pathNode(2, { status: 'not_now' })],
  });

async function signIn() {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply('/v1/me/level', { status: 200, body: myLevelBody() });
  await startSignedIn();
}

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

describe('weekly-path — smart swap (AC3)', () => {
  it('AC3: a not-now node with a swap shows the card, none without one; See place opens it', async () => {
    http.reply(PATH, { status: 200, body: swapPath() });
    await renderApp();

    const card = await screen.findByTestId('path.swap.card');
    expect(screen.getAllByTestId('path.swap.card')).toHaveLength(1);
    expect(card).toHaveTextContent(/Try Long Trail instead/);
    expect(card).toHaveTextContent(/\+1,100 m, 12\.5 km from Blue Lake, clear skies on Sun\./);
    expect(qaEvents()).toContainEqual({ event: 'path_swap_shown', position: 1 });

    http.reply(`/v1/places/${PLACE_IDS.trail}`, apiError(500, 'INTERNAL'));
    await fireEvent.press(screen.getByTestId('path.swap.see'));
    expect(navigationRef.getCurrentRoute()).toMatchObject({ name: 'Place', params: { id: PLACE_IDS.trail } });
  });

  it('AC3: Keep plan hides the card and it stays hidden after a restart', async () => {
    http.reply(PATH, { status: 200, body: swapPath() });
    await renderApp();

    await fireEvent.press(await screen.findByTestId('path.swap.keep'));
    expect(screen.queryByTestId('path.swap.card')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'path_swap_kept', position: 1 });

    await act(() => {
      screen.unmount();
    });
    await renderApp();
    expect(await screen.findByTestId('path.node.1.status')).toHaveTextContent('Not now');
    expect(screen.queryByTestId('path.swap.card')).not.toBeOnTheScreen();
  });
});

describe('weekly-path — done nodes (AC4)', () => {
  it('AC4: a done node shows the Done chip instead of its status', async () => {
    http.reply(PATH, { status: 200, body: pathBody({ nodes: [pathNode(1, { done: true }), pathNode(2)] }) });
    await renderApp();

    expect(await screen.findByTestId('path.node.1.done')).toHaveTextContent('Done');
    expect(screen.queryByTestId('path.node.1.status')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('path.node.2.done')).not.toBeOnTheScreen();
  });

  it('AC4: the debug visit link posts the visit; the path on screen turns the node done from the response', async () => {
    await signIn();
    http.reply(PATH, { status: 200, body: pathBody() });
    const visited = pathBody({ nodes: [pathNode(1, { done: true }), pathNode(2), pathNode(3)] });
    http.reply(VISIT, { status: 200, body: visited });
    await renderApp();
    await screen.findByTestId('path.node.1.status');
    const pathCalls = http.callsTo(PATH).length;

    // Over the Path tab, as when the link opens on a running app.
    const route = linking.getStateFromPath?.(`debug/path/visit/${PLACE_IDS.lake}`, linking.config)?.routes[0];
    expect(route).toMatchObject({ name: 'Debug', params: { pathVisit: PLACE_IDS.lake } });
    await act(() => {
      navigationRef.navigate('Debug', { pathVisit: PLACE_IDS.lake });
    });

    await waitFor(() => expect(qaEvents()).toContainEqual({ event: 'path_visit_debug', placeId: PLACE_IDS.lake }));
    expect(JSON.parse(String(http.callsTo(VISIT)[0]?.data))).toEqual({ placeId: PLACE_IDS.lake });
    const hidden = { includeHiddenElements: true };
    expect(await screen.findByTestId('path.node.1.done', hidden)).toHaveTextContent('Done');
    expect(screen.getByTestId('path.node.1.coins', hidden)).toBeTruthy();
    expect(http.callsTo(PATH)).toHaveLength(pathCalls);
  });

  it('AC4: a failed debug visit shows an error toast', async () => {
    await signIn();
    http.reply(PATH, { status: 200, body: pathBody() });
    http.reply(VISIT, apiError(404, 'PLACE_NOT_ON_PATH'));
    await renderApp();
    await screen.findByTestId('path.node.1.status');

    await openLink(`debug/path/visit/${PLACE_IDS.peak}`);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
  });
});

describe('weekly-path — chest (AC5)', () => {
  it('AC5: a guest tap opens the log-in prompt and posts nothing', async () => {
    http.reply(PATH, { status: 200, body: pathBody({ chest: { required: 3, done: 3, opened: false, xp: 100 } }) });
    await renderApp();

    await fireEvent.press(await screen.findByTestId('path.chest'));
    await waitFor(() => expect(qaEvents().map(e => e.event)).toContain('auth_gate_shown'));
    expect(http.callsTo(OPEN)).toHaveLength(0);
  });

  it('AC5: signed in, a locked chest shows the locked toast and posts nothing', async () => {
    await signIn();
    http.reply(PATH, { status: 200, body: pathBody() });
    await renderApp();

    await fireEvent.press(await screen.findByTestId('path.chest'));
    expect(await screen.findByText('Check in at all 3 places to open it')).toBeOnTheScreen();
    expect(http.callsTo(OPEN)).toHaveLength(0);
  });

  it('AC5: 3 / 3 opens the chest: reward toast, path and level refetched, QA event', async () => {
    await signIn();
    const full = { required: 3, done: 3, opened: false, xp: 100 };
    http.reply(
      PATH,
      { status: 200, body: pathBody({ chest: full }) },
      { status: 200, body: pathBody({ chest: { ...full, opened: true } }) },
    );
    http.reply(OPEN, { status: 200, body: { opened: true, xp: 100, levelUps: [] } });
    await renderApp();
    await waitFor(() => expect(http.callsTo('/v1/me/level').length).toBeGreaterThan(0));
    const levelCalls = http.callsTo('/v1/me/level').length;

    await fireEvent.press(await screen.findByTestId('path.chest'));

    expect(await screen.findByText('Chest opened! +100 XP')).toBeOnTheScreen();
    expect(http.callsTo(OPEN)).toHaveLength(1);
    expect(qaEvents()).toContainEqual({ event: 'path_chest_opened', month: '2026-10', xp: 100 });
    await waitFor(() => expect(http.callsTo(PATH)).toHaveLength(2));
    await waitFor(() => expect(http.callsTo('/v1/me/level').length).toBeGreaterThan(levelCalls));
    expect(screen.getByTestId('path.chest')).toHaveProp('accessibilityLabel', 'Opened this month');
  });

  it('AC5: a 409 refetches the path and shows the locked toast', async () => {
    await signIn();
    http.reply(PATH, { status: 200, body: pathBody({ chest: { required: 3, done: 3, opened: false, xp: 100 } }) });
    http.reply(OPEN, apiError(409, 'PATH_CHEST_LOCKED'));
    await renderApp();

    await fireEvent.press(await screen.findByTestId('path.chest'));

    expect(await screen.findByText('Check in at all 3 places to open it')).toBeOnTheScreen();
    await waitFor(() => expect(http.callsTo(PATH)).toHaveLength(2));
  });
});
