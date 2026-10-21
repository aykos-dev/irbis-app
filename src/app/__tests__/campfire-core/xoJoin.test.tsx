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

/** Scans the QR, joins, and waits for the player lobby. */
async function joinByQr() {
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
  await screen.findByTestId('camp.lobby.wait');
}

describe('campfire-xo — Back on the player board (XO-1)', () => {
  it('Back does not strand the joiner in the lobby; the host ending the series shows the final score', async () => {
    const server = await hostRoom();
    await joinByQr();

    await act(() => server.startXo());
    expect(await screen.findByTestId('xo.board')).toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()).toMatchObject({
      name: 'CampGame',
      params: { player: true },
    });

    await act(() => {
      navigationRef.goBack();
    });

    // XO-1: the running board stays; Back must not drop the joiner into the lobby.
    expect(screen.getByTestId('xo.board')).toBeOnTheScreen();
    expect(screen.queryByTestId('camp.lobby.wait')).not.toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()).toMatchObject({
      name: 'CampGame',
      params: { player: true },
    });

    await act(() => server.xoEnd());

    // The final score reaches the joiner instead of "waiting for the host".
    expect(await screen.findByTestId('xo.final')).toBeOnTheScreen();
    expect(screen.queryByTestId('camp.lobby.wait')).not.toBeOnTheScreen();
  });
});
