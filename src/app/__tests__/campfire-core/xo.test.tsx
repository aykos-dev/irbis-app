import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
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

const net = jest.mocked(campNet);

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
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_0', animal: 'fox' }));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await tearDownApp(http);
});

const roomCode = () => String(screen.getByTestId('camp.lobby.code').props.children);

async function join(nickname: string, v = 4): Promise<FakeSocket> {
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v, type: 'hello', code: roomCode(), nickname, avatar: 'bear' });
  });
  return client;
}

async function openXoLobby() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'xo' });
  });
  await screen.findByTestId('camp.lobby.code');
}

const lastGame = (socket: FakeSocket) =>
  socket
    .received()
    .filter(message => message.type === 'game')
    .at(-1);

async function move(socket: FakeSocket, cell: number, gameNo = 1) {
  await act(() => socket.send({ v: 4, type: 'xoMove', round: 1, gameNo, cell }));
}

describe('campfire-xo — tile and Start (AC1)', () => {
  it('AC1: the hub has an X and O tile; the lobby pill is selectable', async () => {
    await renderApp();
    await openTab('community');
    await screen.findByTestId('camp.hub.screen');
    expect(screen.getByTestId('camp.hub.game.xo')).toHaveTextContent(/X and O/);

    await openXoLobby();
    expect(screen.getByTestId('camp.lobby.game.xo')).toBeSelected();
  });

  it('AC1: Start needs exactly 2 seats; a v3 phone gets the version rejection', async () => {
    await openXoLobby();
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    expect(screen.getByTestId('camp.lobby.start-reason')).toHaveTextContent('X and O is for 2 players');

    const old = await join('guest_9', 3);
    expect(old.received().at(-1)).toEqual({ v: 4, type: 'rejected', reason: 'version' });

    await join('guest_1');
    expect(screen.getByTestId('camp.lobby.start')).toBeEnabled();
    expect(screen.queryByTestId('camp.lobby.start-reason')).not.toBeOnTheScreen();

    await join('guest_2');
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    expect(screen.getByTestId('camp.lobby.start-reason')).toHaveTextContent('X and O is for 2 players');
  });
});

describe('campfire-xo — turns and result (AC2, AC3)', () => {
  it('AC2: host taps on its turn, the joiner moves by xoMove; out-of-turn and taken cells are ignored', async () => {
    await openXoLobby();
    const joiner = await join('guest_1');
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));
    await screen.findByTestId('xo.board');
    expect(qaEvents()).toContainEqual({ event: 'camp_game_started', game: 'xo', players: 2 });
    expect(screen.getByTestId('xo.turn')).toHaveTextContent('Your turn');
    expect(lastGame(joiner)).toMatchObject({
      game: 'xo',
      public: { xSeatId: 'host', oSeatId: 'p1', turn: 'x', gameNo: 1 },
    });

    await move(joiner, 0);
    expect(lastGame(joiner)).toMatchObject({ public: { board: Array(9).fill(null) } });

    await fireEvent.press(screen.getByTestId('xo.cell.4'));
    expect(screen.getByTestId('xo.turn')).toHaveTextContent("guest_1's turn");
    expect(screen.getByTestId('xo.cell.0')).toBeDisabled();
    expect(lastGame(joiner)).toMatchObject({ public: { turn: 'o' } });
    expect(qaEvents()).toContainEqual({ event: 'xo_move', gameNo: 1, cell: 4, mark: 'x' });

    await move(joiner, 4);
    await move(joiner, 0, 2);
    expect(screen.getByTestId('xo.turn')).toHaveTextContent("guest_1's turn");
    await move(joiner, 0);
    expect(screen.getByTestId('xo.turn')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('xo.cell.0')).toHaveProp('accessibilityLabel', 'Cell 1, O');
  });

  it('AC3: three in a row shows the banner on the host and the result to the joiner; the board locks', async () => {
    await openXoLobby();
    const joiner = await join('guest_1');
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));
    await screen.findByTestId('xo.board');

    await fireEvent.press(screen.getByTestId('xo.cell.0'));
    await move(joiner, 4);
    await fireEvent.press(screen.getByTestId('xo.cell.1'));
    await move(joiner, 8);
    await fireEvent.press(screen.getByTestId('xo.cell.3'));
    await move(joiner, 2);
    await fireEvent.press(screen.getByTestId('xo.cell.5'));
    await move(joiner, 6);

    expect(screen.getByTestId('xo.result')).toHaveTextContent('guest_1 wins!');
    expect(screen.queryByTestId('xo.turn')).not.toBeOnTheScreen();
    expect(screen.getByTestId('xo.cell.7')).toBeDisabled();
    expect(lastGame(joiner)).toMatchObject({
      public: { result: { kind: 'win', mark: 'o', line: [2, 4, 6] }, score: { host: 0, p1: 1 } },
    });
    expect(qaEvents()).toContainEqual({ event: 'xo_result', gameNo: 1, kind: 'win', mark: 'o' });
  });
});
