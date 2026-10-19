import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeCamera, fakeNet, fakeWifi } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { buildJoinUrl } from '../../../features/campfire-core/protocol/qr';
import { createHostServer, type HostServer } from '../../../features/campfire-core/room/hostServer';
import { createRoom } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import { openTab, renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));

const HOST_IP = '192.168.49.1';
const wifi = { ssid: 'DIRECT-irbis', password: 'pw_1' };
const qr = buildJoinUrl({ code: '4821', ip: HOST_IP, port: 47821, wifi });
const rng = () => 0;

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  jest.useFakeTimers();
  fakeNet.reset();
  fakeCamera.reset();
  fakeWifi.reset();
  jest.mocked(campNet.getWifiIp).mockReset().mockResolvedValue('192.168.49.23');
  jest.mocked(campNet.getWifiName).mockReset().mockResolvedValue(null);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_1', animal: 'bear' }));
});
afterEach(async () => {
  jest.useRealTimers();
  await tearDownApp(http);
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function hostRoom(): Promise<HostServer> {
  const server = createHostServer({
    room: createRoom('4821', { nickname: 'guest_0', avatar: 'fox' }),
    network: wifi.ssid,
    onChange: () => undefined,
  });
  await server.start();
  fakeNet.serve(HOST_IP, fakeNet.server());
  return server;
}

/** Scans the QR and joins; `lands` is the testID the player ends up on. */
async function joinByQr(lands = 'camp.lobby.wait') {
  await renderApp();
  await openTab('community');
  await act(() => {
    navigationRef.navigate('CampJoin');
  });
  await screen.findByTestId('camp.join.screen');
  await act(async () => {
    fakeCamera.scan(qr);
    await jest.advanceTimersByTimeAsync(10);
  });
  await fireEvent.press(await screen.findByTestId('camp.join.submit'));
  await advance(10);
  await screen.findByTestId(lands);
}

describe('campfire-party — player phones (AC2)', () => {
  it('AC2: Start opens the game route on the player phone; the host ending it returns to the lobby', async () => {
    const server = await hostRoom();
    await joinByQr();

    await act(() => server.startGame('rather', { packId: 'rather-camping', imposters: 1, showCategory: true }, rng));
    expect(await screen.findByTestId('camp.game.waiting')).toBeOnTheScreen();
    expect(screen.getByText('Would you rather')).toBeOnTheScreen();
    expect(screen.queryByTestId('camp.game.in-progress')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('camp.game.end')).not.toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()).toMatchObject({ name: 'CampGame', params: { player: true } });

    await act(() => server.endGame());
    expect(await screen.findByTestId('camp.lobby.wait')).toHaveTextContent('Waiting for the host to start', {
      exact: false,
    });
    expect(navigationRef.getCurrentRoute()?.name).toBe('CampLobby');
  });

  it('AC2: joining mid-round shows "Round in progress — you\'re in the next one"', async () => {
    const server = await hostRoom();
    const other = fakeNet.server().connect();
    await act(() => other.send({ v: 2, type: 'hello', code: '4821', nickname: 'guest_2', avatar: 'eagle' }));
    await act(() => server.startGame('rather', { packId: 'rather-camping', imposters: 1, showCategory: true }, rng));

    await joinByQr('camp.game.waiting');
    expect(screen.getByTestId('camp.game.in-progress')).toHaveTextContent(
      "Round in progress — you're in the next one",
      { exact: false },
    );
  });
});
