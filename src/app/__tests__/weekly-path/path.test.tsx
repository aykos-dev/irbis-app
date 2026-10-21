import { fireEvent, screen } from '@testing-library/react-native';

import {
  apiError,
  goOffline,
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { axiosInstance } from '../../../shared/api/client';
import { storage } from '../../../shared/storage';
import { tashkentMonth } from '../../../features/weekly-path/pathMonth';
import { pathBody, pathNode, PLACE_IDS } from '../../../features/weekly-path/__tests__/harness';

let http: HttpStub;

const PATH = '/v1/path';

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('weekly-path — nodes (AC1, AC2)', () => {
  it('AC1/AC2: a guest request carries interests; 3 nodes + chest show the chip for each status', async () => {
    storage.setString('onboarding.interests', JSON.stringify(['peaks', 'lakes']));
    http.reply(PATH, { status: 200, body: pathBody() });
    await renderApp();

    expect(await screen.findByTestId('path.node.1')).toBeOnTheScreen();
    expect(axiosInstance.getUri(http.callsTo(PATH)[0])).toContain('/v1/path?interests=peaks,lakes');
    expect(screen.getByTestId('path.node.1.status')).toHaveTextContent('Go · Sat');
    expect(screen.getByTestId('path.node.2.status')).toHaveTextContent('Caution · Strong wind on Saturday — 45 km/h');
    expect(screen.getByTestId('path.node.3.status')).toHaveTextContent('Opens in May');
    expect(screen.getByTestId('path.chest')).toHaveProp(
      'accessibilityLabel',
      '1 / 3 · Check in at all 3 places',
    );
    expect(qaEvents()).toContainEqual({ event: 'path_loaded', month: '2026-10', nodes: 3, guest: true });
  });

  it('AC2: not now shows the worried mascot, no status shows no chip; a node opens its popover → Place', async () => {
    http.reply(PATH, {
      status: 200,
      body: pathBody({ nodes: [pathNode(1, { status: 'not_now' }), pathNode(2, { status: null })] }),
    });
    await renderApp();

    expect(await screen.findByTestId('path.node.1.status')).toHaveTextContent('Not now');
    expect(screen.getByTestId('path.node.1.mascot')).toBeOnTheScreen();
    expect(screen.queryByTestId('path.node.2.status')).not.toBeOnTheScreen();
    expect(axiosInstance.getUri(http.callsTo(PATH)[0])).not.toContain('interests');

    await fireEvent.press(screen.getByTestId('path.node.2'));
    expect(screen.getByTestId('path.popover')).toHaveTextContent(/Big Peak/);
    await fireEvent.press(screen.getByTestId('path.popover.backdrop'));
    expect(screen.queryByTestId('path.popover')).not.toBeOnTheScreen();

    http.reply(`/v1/places/${PLACE_IDS.lake}`, apiError(500, 'INTERNAL'));
    await fireEvent.press(screen.getByTestId('path.node.1'));
    await fireEvent.press(screen.getByTestId('path.popover.open-place'));
    expect(navigationRef.getCurrentRoute()).toMatchObject({ name: 'Place', params: { id: PLACE_IDS.lake } });
  });
});

describe('weekly-path — header and weather (AC6, AC7)', () => {
  it('AC6/AC7: subtitle with month, level and season; weather days with the credit; info opens the sheet', async () => {
    http.reply(PATH, { status: 200, body: pathBody() });
    await renderApp();

    await screen.findByTestId('path.node.1');
    expect(screen.getByTestId('path.subtitle')).toHaveTextContent('October · built for Wanderer, autumn');
    expect(screen.queryByTestId('path.xp')).not.toBeOnTheScreen();
    expect(screen.getByTestId('path.weather')).toHaveTextContent(/Weather data by Open-Meteo.com/);
    expect(screen.getByTestId('path.weather.fri')).toHaveTextContent(/Fri.*22°.*Wind 10 km\/h/);
    expect(screen.getByTestId('path.weather.sat')).toHaveTextContent(/Sat.*18°/);

    await fireEvent.press(screen.getByTestId('path.info'));
    expect(await screen.findByTestId('path.info.sheet')).toHaveTextContent(/How the path is built/);
  });

  it('AC7: no weather days hides the strip', async () => {
    http.reply(PATH, { status: 200, body: pathBody({ weather: { days: [] } }) });
    await renderApp();

    expect(await screen.findByTestId('path.node.1')).toBeOnTheScreen();
    expect(screen.queryByTestId('path.weather')).not.toBeOnTheScreen();
  });
});

describe('weekly-path — states (AC8)', () => {
  it('AC8: no nodes shows the empty state whose button opens Explore', async () => {
    http.reply(PATH, { status: 200, body: pathBody({ nodes: [], chest: null }) });
    await renderApp();

    expect(await screen.findByTestId('path.empty')).toHaveTextContent(/No places match your level/);
    await fireEvent.press(screen.getByTestId('path.empty.cta'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('Explore');
  });

  it('AC8: an error shows Retry, which loads the path', async () => {
    http.reply(PATH, apiError(500, 'INTERNAL'), { status: 200, body: pathBody() });
    await renderApp();

    await fireEvent.press(await screen.findByTestId('path.retry'));
    expect(await screen.findByTestId('path.node.1')).toBeOnTheScreen();
  });

  it('AC8: offline without a cached path shows the offline state and sends nothing', async () => {
    await goOffline();
    await renderApp();

    expect(await screen.findByTestId('path.offline')).toHaveTextContent(/You're offline/);
    expect(http.callsTo(PATH)).toHaveLength(0);
  });

  it("AC8: offline shows this month's cached path with the offline banner", async () => {
    storage.setString(`path.cache.${tashkentMonth()}`, JSON.stringify(pathBody({ month: tashkentMonth() })));
    await goOffline();
    await renderApp();

    expect(await screen.findByTestId('path.node.1.status')).toHaveTextContent('Go · Sat');
    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
    expect(http.callsTo(PATH)).toHaveLength(0);
  });

  it('AC8: a path from an earlier month is refetched when the tab comes back into focus', async () => {
    http.reply(PATH, { status: 200, body: pathBody({ month: '2000-01' }) }, { status: 200, body: pathBody({ month: tashkentMonth() }) });
    await renderApp();
    await screen.findByTestId('path.node.1');
    expect(http.callsTo(PATH)).toHaveLength(1);

    http.reply('/v1/lessons', apiError(500, 'INTERNAL'));
    await openTab('lessons');
    await openTab('path');

    expect(await screen.findByTestId('path.node.1')).toBeOnTheScreen();
    expect(http.callsTo(PATH)).toHaveLength(2);
  });
});
