import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { fakeCamera, fakeNet, fakeWifi, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { defaultCounts } from '../../../features/campfire-core/games/mafia/roles';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { secureScreen } from '../../../features/campfire-core/native/secureScreen';
import { buildJoinUrl } from '../../../features/campfire-core/protocol/qr';
import { createHostServer } from '../../../features/campfire-core/room/hostServer';
import { createRoom } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));
jest.mock('../../../features/campfire-core/native/secureScreen', () => ({
  secureScreen: {
    setSecure: jest.fn(),
    isCaptured: jest.fn(),
    onCaptureChange: jest.fn(),
  },
}));

const net = jest.mocked(campNet);
const secure = jest.mocked(secureScreen);

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  fakeNet.reset();
  net.requestHotspotPermission.mockReset().mockResolvedValue(true);
  net.startHotspot
    .mockReset()
    .mockResolvedValue({ ssid: 'DIRECT-irbis', password: 'pw_1', ip: '192.168.49.1' });
  net.stopHotspot.mockReset().mockResolvedValue(undefined);
  net.getWifiIp.mockReset().mockResolvedValue(null);
  net.getWifiName.mockReset().mockResolvedValue(null);
  secure.setSecure.mockReset();
  secure.isCaptured.mockReset().mockResolvedValue(false);
  secure.onCaptureChange.mockReset().mockReturnValue(() => undefined);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_0', animal: 'fox' }));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await tearDownApp(http);
});

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const lastGame = (client: FakeSocket) =>
  client.received().filter(message => message.type === 'game').at(-1);
const suggested = () => qaEvents().filter(entry => entry.event === 'maf_win_suggested');

/** Host + 6 players dealt with no shuffle: p1 boss, p2 mafia, p3 detective, p4 doctor, p5–p6 civilians. */
async function hostMafia(): Promise<FakeSocket[]> {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'mafia' });
  });
  await screen.findByTestId('maf.setup');
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const clients: FakeSocket[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const client = fakeNet.server().connect();
    await act(() => {
      client.send({ v: 4, type: 'hello', code, nickname: `guest_${i}`, avatar: 'bear' });
    });
    clients.push(client);
  }
  jest.spyOn(Math, 'random').mockReturnValue(0.99);
  await press('maf.deal');
  await screen.findByTestId('maf.host');
  return clients;
}

async function markOut(seatId: string) {
  await press(`maf.player.${seatId}`);
  await press(screen.queryByTestId('maf.sheet.killed') ? 'maf.sheet.killed' : 'maf.sheet.exiled');
}

describe('campfire-mafia — win check and game over, host (AC6)', () => {
  it('AC6: a win asks the host once per out-set; End game sends every phone the winner and all roles', async () => {
    const clients = await hostMafia();

    await markOut('p3');
    expect(screen.queryByTestId('maf.win-sheet')).not.toBeOnTheScreen();
    await markOut('p4');
    expect(screen.getByTestId('maf.win-sheet')).toHaveTextContent(/Mafia wins\?/);
    expect(suggested()).toEqual([{ event: 'maf_win_suggested', winner: 'mafia' }]);

    // Keep playing: the same out-set is not asked again, even after a mark back and out again.
    await press('maf.win-keep');
    expect(screen.queryByTestId('maf.win-sheet')).not.toBeOnTheScreen();
    await press('maf.phase-next');
    await press('maf.player.p4');
    await press('maf.sheet.back');
    await markOut('p4');
    expect(screen.queryByTestId('maf.win-sheet')).not.toBeOnTheScreen();
    expect(suggested()).toHaveLength(1);

    // A new out-set asks again.
    await markOut('p5');
    expect(screen.getByTestId('maf.win-sheet')).toBeOnTheScreen();
    expect(suggested()).toHaveLength(2);
    await press('maf.win-end');

    expect(await screen.findByTestId('maf.over')).toBeOnTheScreen();
    expect(screen.getByText('Mafia wins!')).toBeOnTheScreen();
    expect(screen.getByText('GAME OVER · Day 1')).toBeOnTheScreen();
    expect(screen.getByText('3 players survived')).toBeOnTheScreen();
    expect(within(screen.getByTestId('maf.over.p3')).getByText('Detective')).toBeOnTheScreen();
    expect(screen.queryByTestId('camp.game.end')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_game_ended', game: 'mafia', rounds: 1, winner: 'mafia' });
    expect(lastGame(clients[5] as FakeSocket)).toMatchObject({
      public: {
        ended: {
          winner: 'mafia',
          roles: { p1: 'boss', p2: 'mafia', p3: 'detective', p4: 'doctor', p5: 'civilian', p6: 'civilian' },
        },
      },
    });
  });

  it('AC6: End game with no match asks "End without a winner?"; Play again re-deals round 2', async () => {
    const clients = await hostMafia();

    await press('camp.game.end');
    expect(screen.getByTestId('camp.game.end-sheet')).toHaveTextContent(/End without a winner\?/);
    await press('camp.game.end-confirm');
    expect(await screen.findByTestId('maf.over')).toBeOnTheScreen();
    expect(screen.getByText('Game over')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_game_ended', game: 'mafia', rounds: 1, winner: 'none' });
    expect(lastGame(clients[0] as FakeSocket)).toMatchObject({ public: { ended: { winner: 'none' } } });

    await press('maf.play-again');
    expect(await screen.findByTestId('maf.host')).toBeOnTheScreen();
    expect(screen.getByText('Night 1')).toBeOnTheScreen();
    clients.forEach(client => {
      const deals = client.received().filter(message => message.type === 'deal');
      expect(deals.at(-1)).toMatchObject({ game: 'mafia', round: 2 });
      expect(lastGame(client)).toMatchObject({ round: 2, public: { out: [] } });
      expect(lastGame(client)?.public).not.toHaveProperty('ended');
    });
    expect(qaEvents()).toContainEqual({ event: 'camp_round_started', game: 'mafia', round: 2 });
  });

  it('AC6: Play again with too few connected players goes back to the setup', async () => {
    const clients = await hostMafia();
    await press('camp.game.end');
    await press('camp.game.end-confirm');
    await screen.findByTestId('maf.over');

    await act(() => {
      clients[4]?.drop();
      clients[5]?.drop();
    });
    await press('maf.play-again');
    expect(await screen.findByTestId('maf.setup')).toBeOnTheScreen();
    expect(clients[0]?.received().at(-1)).toEqual({ v: 4, type: 'lobby' });
  });
});

describe('campfire-mafia — game over, player phone (AC6)', () => {
  const HOST_IP = '192.168.49.1';
  const wifi = { ssid: 'DIRECT-irbis', password: 'pw_1' };

  beforeEach(() => {
    jest.useFakeTimers();
    fakeCamera.reset();
    fakeWifi.reset();
    net.getWifiIp.mockResolvedValue('192.168.49.23');
    storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_1', animal: 'bear' }));
  });

  it('AC6: the player sees the winner, everyone\'s role and waits for the host', async () => {
    const server = createHostServer({
      room: createRoom('4821', { nickname: 'guest_0', avatar: 'fox' }),
      network: wifi.ssid,
      onChange: () => undefined,
    });
    await server.start();
    fakeNet.serve(HOST_IP, fakeNet.server());

    await renderApp();
    await openTab('community');
    await act(() => {
      navigationRef.navigate('CampJoin');
    });
    await screen.findByTestId('camp.join.screen');
    await act(async () => {
      fakeCamera.scan(buildJoinUrl({ code: '4821', ip: HOST_IP, port: 47821, wifi }));
      await jest.advanceTimersByTimeAsync(10);
    });
    await fireEvent.press(await screen.findByTestId('camp.join.submit'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    await screen.findByTestId('camp.lobby.wait');
    for (let i = 2; i <= 5; i += 1) {
      const other = fakeNet.server().connect();
      await act(() => other.send({ v: 4, type: 'hello', code: '4821', nickname: `guest_${i}`, avatar: 'eagle' }));
    }
    await act(() => server.startMafia({ counts: defaultCounts(5), revealOut: false }, () => 0.99));
    await screen.findByTestId('maf.player');

    await act(() => server.mafMarkOut('p1'));
    await act(() => server.mafEnd('mafia'));
    expect(screen.getByTestId('maf.over')).toBeOnTheScreen();
    expect(screen.getByText('Mafia wins!')).toBeOnTheScreen();
    expect(screen.getByText('4 players survived')).toBeOnTheScreen();
    expect(within(screen.getByTestId('maf.over.p2')).getByText('Detective')).toBeOnTheScreen();
    expect(within(screen.getByTestId('maf.over.p1')).getByText('killed · Night 1')).toBeOnTheScreen();
    expect(screen.getByTestId('maf.wait-host')).toHaveTextContent('Waiting for the host');
    expect(screen.queryByTestId('maf.play-again')).not.toBeOnTheScreen();
  });
});
