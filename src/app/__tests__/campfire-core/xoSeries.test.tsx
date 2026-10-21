import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { storage } from '../../../shared/storage';
import {
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
const audio: { __started: jest.Mock } = jest.requireMock('react-native-audio-api');

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  fakeNet.reset();
  audio.__started.mockClear();
  net.requestHotspotPermission.mockReset().mockResolvedValue(true);
  net.startHotspot
    .mockReset()
    .mockResolvedValue({ ssid: 'DIRECT-irbis', password: 'pw_1', ip: '192.168.49.1' });
  net.stopHotspot.mockReset().mockResolvedValue(undefined);
  net.getWifiIp.mockReset().mockResolvedValue(null);
  net.getWifiName.mockReset().mockResolvedValue(null);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_0', animal: 'fox' }));
  storage.setString('lessons.muted', '0');
});
afterEach(async () => {
  jest.restoreAllMocks();
  await tearDownApp(http);
});

/** Clip names played so far on this (host) phone, e.g. `lesson-complete`. */
function played(): string[] {
  return audio.__started.mock.calls.map(([source]: [{ testUri: string }]) =>
    source.testUri.replace(/^.*\/(lesson-[a-z]+)\.m4a$/, '$1'),
  );
}

let code = '';

async function join(nickname: string, seatToken?: string): Promise<FakeSocket> {
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({
      v: 4,
      type: 'hello',
      code,
      nickname,
      avatar: 'bear',
      ...(seatToken ? { seatToken } : {}),
    });
  });
  return client;
}

/** Host + guest_1 (seat p1) on the X and O board, game 1, host X. */
async function startSeries(): Promise<FakeSocket> {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'xo' });
  });
  code = String((await screen.findByTestId('camp.lobby.code')).props.children);
  const joiner = await join('guest_1');
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('xo.board');
  return joiner;
}

const lastGame = (socket: FakeSocket) =>
  socket
    .received()
    .filter(message => message.type === 'game')
    .at(-1);

const tap = (cell: number) => fireEvent.press(screen.getByTestId(`xo.cell.${cell}`));

async function joinerMove(socket: FakeSocket, cell: number, gameNo: number) {
  await act(() => socket.send({ v: 4, type: 'xoMove', round: 1, gameNo, cell }));
}

/** Game 1, host X: the host takes the top row. */
async function hostWinsGame1(joiner: FakeSocket) {
  await tap(0);
  await joinerMove(joiner, 3, 1);
  await tap(1);
  await joinerMove(joiner, 4, 1);
  await tap(2);
}

describe('campfire-xo — series, next game, score, sounds (AC4, AC5, AC8)', () => {
  it('AC4/AC5/AC8: win sounds, Next swaps marks (either phone), stale next ignored, score and draws carry, mute', async () => {
    const joiner = await startSeries();
    expect(screen.getByTestId('xo.game')).toHaveTextContent('Game 1');
    expect(screen.getByTestId('xo.draws')).toHaveTextContent('Draws 0');

    await hostWinsGame1(joiner);
    expect(played()).toEqual(['lesson-complete']);
    expect(screen.getByTestId('xo.score.host')).toHaveTextContent(/1/);

    await fireEvent.press(screen.getByTestId('xo.next'));
    expect(screen.getByTestId('xo.game')).toHaveTextContent('Game 2');
    expect(screen.queryByTestId('xo.next')).not.toBeOnTheScreen();
    expect(screen.getByTestId('xo.turn')).toHaveTextContent("guest_1's turn");
    expect(lastGame(joiner)).toMatchObject({
      public: { gameNo: 2, xSeatId: 'p1', oSeatId: 'host', turn: 'x', result: null, board: Array(9).fill(null) },
    });
    expect(qaEvents()).toContainEqual({ event: 'xo_next', gameNo: 2 });

    // Game 2, guest_1 is X and wins the left column; the losing host hears "wrong".
    await joinerMove(joiner, 0, 2);
    await tap(1);
    await joinerMove(joiner, 3, 2);
    await tap(2);
    await joinerMove(joiner, 6, 2);
    expect(played()).toEqual(['lesson-complete', 'lesson-wrong']);
    expect(screen.getByTestId('xo.score.p1')).toHaveTextContent(/1/);

    await act(() => joiner.send({ v: 4, type: 'xoNext', round: 1, gameNo: 1 }));
    expect(screen.getByTestId('xo.game')).toHaveTextContent('Game 2');
    await act(() => joiner.send({ v: 4, type: 'xoNext', round: 1, gameNo: 2 }));
    expect(screen.getByTestId('xo.game')).toHaveTextContent('Game 3');
    expect(screen.getByTestId('xo.turn')).toHaveTextContent('Your turn');

    // Game 3: draw, sounds muted from the header.
    await fireEvent.press(screen.getByTestId('xo.mute'));
    expect(screen.getByTestId('xo.mute')).toHaveProp('accessibilityLabel', 'Turn sounds on');
    await tap(0);
    await joinerMove(joiner, 1, 3);
    await tap(2);
    await joinerMove(joiner, 4, 3);
    await tap(3);
    await joinerMove(joiner, 5, 3);
    await tap(7);
    await joinerMove(joiner, 6, 3);
    await tap(8);
    expect(screen.getByTestId('xo.result')).toHaveTextContent('Draw');
    expect(screen.getByTestId('xo.draws')).toHaveTextContent('Draws 1');
    expect(played()).toEqual(['lesson-complete', 'lesson-wrong']);
    expect(lastGame(joiner)).toMatchObject({ public: { score: { host: 1, p1: 1 }, draws: 1 } });
  });

  it('AC8: a draw plays "correct"', async () => {
    const joiner = await startSeries();
    await tap(0);
    await joinerMove(joiner, 1, 1);
    await tap(2);
    await joinerMove(joiner, 4, 1);
    await tap(3);
    await joinerMove(joiner, 5, 1);
    await tap(7);
    await joinerMove(joiner, 6, 1);
    await tap(8);
    expect(played()).toEqual(['lesson-correct']);
  });
});

describe('campfire-xo — pause on drop (AC6)', () => {
  it('AC6: joiner drops → paused, cells disabled, moves ignored; same seat back → same board and turn', async () => {
    const joiner = await startSeries();
    const token = String(joiner.received()[0]?.seatToken);
    await tap(4);

    await act(() => {
      joiner.drop();
    });
    expect(screen.getByTestId('xo.paused')).toHaveTextContent('Waiting for guest_1…');
    expect(screen.queryByTestId('xo.turn')).not.toBeOnTheScreen();
    expect(screen.getByTestId('xo.cell.0')).toBeDisabled();
    expect(qaEvents()).toContainEqual({ event: 'xo_paused', paused: true });

    const back = await join('guest_1', token);
    expect(screen.queryByTestId('xo.paused')).not.toBeOnTheScreen();
    expect(screen.getByTestId('xo.turn')).toHaveTextContent("guest_1's turn");
    expect(qaEvents()).toContainEqual({ event: 'xo_paused', paused: false });
    expect(lastGame(back)).toMatchObject({
      public: { paused: false, turn: 'o', gameNo: 1, board: [null, null, null, null, 'x', null, null, null, null] },
    });
    await joinerMove(back, 0, 1);
    expect(screen.getByTestId('xo.turn')).toHaveTextContent('Your turn');
  });
});

describe('campfire-xo — End, final score, play again (AC7)', () => {
  it('AC7: End asks first; final score on both phones; Play again resets; Lobby goes back', async () => {
    const joiner = await startSeries();
    await hostWinsGame1(joiner);

    await fireEvent.press(screen.getByTestId('xo.end'));
    expect(screen.getByTestId('camp.game.end-sheet')).toHaveTextContent(/End the series\?/);
    await fireEvent.press(screen.getByTestId('camp.game.end-cancel'));
    expect(screen.getByTestId('xo.board')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('xo.end'));
    expect(screen.getByTestId('camp.game.end-cancel')).toHaveTextContent('Keep playing');
    await fireEvent.press(screen.getByTestId('camp.game.end-confirm'));
    expect(await screen.findByTestId('xo.final')).toHaveTextContent(/Final score/);
    expect(screen.getByTestId('xo.final.line')).toHaveTextContent('You win the series 1–0');
    expect(screen.getByTestId('xo.final.stats')).toHaveTextContent('Draws 0 · Games 1');
    expect(lastGame(joiner)).toMatchObject({
      public: { ended: { games: 1, draws: 0, score: { host: 1, p1: 0 } } },
    });
    expect(qaEvents()).toContainEqual({ event: 'camp_game_ended', game: 'xo', games: 1, draws: 0 });

    await fireEvent.press(screen.getByTestId('xo.play-again'));
    expect(await screen.findByTestId('xo.board')).toBeOnTheScreen();
    expect(screen.getByTestId('xo.game')).toHaveTextContent('Game 1');
    expect(screen.getByTestId('xo.turn')).toHaveTextContent('Your turn');
    expect(lastGame(joiner)).toMatchObject({
      round: 2,
      public: { gameNo: 1, xSeatId: 'host', score: { host: 0, p1: 0 }, draws: 0 },
    });
    expect(lastGame(joiner)?.public).not.toHaveProperty('ended');

    await fireEvent.press(screen.getByTestId('xo.end'));
    await fireEvent.press(screen.getByTestId('camp.game.end-confirm'));
    expect(screen.getByTestId('xo.final.line')).toHaveTextContent("It's a tie 0–0");
    await fireEvent.press(screen.getByTestId('xo.lobby'));
    expect(await screen.findByTestId('camp.lobby.code')).toBeOnTheScreen();
    expect(joiner.received().at(-1)).toEqual({ v: 4, type: 'lobby' });
  });
});
