import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import type { CrocState } from '../../../features/campfire-core/games/gameReducer';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { secureScreen } from '../../../features/campfire-core/native/secureScreen';
import { storage } from '../../../shared/storage';
import { qaEvents, renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';

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

// A whole turn of fake time (ring frames, pings, broadcasts) runs per test; allow for a busy parallel run.
jest.setTimeout(20000);

const net = jest.mocked(campNet);
const secure = jest.mocked(secureScreen);

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  // Microtasks stay real: a React cleanup run inside a faked microtask can clear a due interval mid-tick.
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
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

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Lets `ms` pass while both players keep pinging (the host drops a silent seat after 10 s). */
async function play(ms: number, players: FakeSocket[]) {
  for (let left = ms; left > 0; left -= 6000) {
    players.forEach(socket => socket.send({ v: 5, type: 'ping' }));
    await advance(Math.min(6000, left));
  }
}

async function join(nickname: string): Promise<FakeSocket> {
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v: 5, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

/** Host + guest_1 (p1) + guest_2 (p2); p1 shows and has started the 30 s turn. */
async function runningTurn(): Promise<[FakeSocket, FakeSocket]> {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'croc' });
  });
  await screen.findByTestId('camp.lobby.code');
  const players: [FakeSocket, FakeSocket] = [await join('guest_1'), await join('guest_2')];
  await fireEvent.press(screen.getByTestId('croc.settings.timer.30'));
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('croc.pick');
  await fireEvent.press(screen.getByTestId('croc.pick.p1'));
  await act(() => players[0].send({ v: 5, type: 'crocStart', round: 1, turnNo: 1 }));
  return players;
}

const lastGame = (socket: FakeSocket) => socket.received().filter(message => message.type === 'game').at(-1);

function saved(): CrocState {
  const room: { game: CrocState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}

describe('campfire-crocodile — timer and turn end (AC4, AC5)', () => {
  it("AC4/AC5: every phone gets the time left; the host's timer ends the turn, the result shows ~3 s, then pick", async () => {
    const [first, second] = await runningTurn();
    const word = saved().word;
    expect(lastGame(second)).toMatchObject({ phase: 'running', public: { remainingMs: 30000 } });
    expect(qaEvents()).toContainEqual({ event: 'croc_start', turnNo: 1, durationSec: 30 });
    expect(screen.getByTestId('croc.timer.seconds')).toHaveTextContent('30');

    await play(29000, [first, second]);
    expect(saved().phase).toBe('running');
    await play(1000, [first, second]);
    expect(lastGame(first)).toMatchObject({
      phase: 'result',
      public: { result: { kind: 'timeUp', word }, totals: { turns: 1, guessed: 0 } },
    });
    expect(screen.getByTestId('croc.result')).toHaveTextContent(/^Time's up!/);
    expect(qaEvents()).toContainEqual({ event: 'croc_turn_end', turnNo: 1, kind: 'timeUp' });

    await play(3000, [first, second]);
    expect(lastGame(second)).toMatchObject({ phase: 'pick' });
    expect(screen.getByTestId('croc.pick')).toBeOnTheScreen();
  });

  it('AC5: Guessed! from the describer counts once; a stale or late one is ignored; the timer no longer ends the turn', async () => {
    const [first, second] = await runningTurn();
    await act(() => second.send({ v: 5, type: 'crocGuessed', round: 1, turnNo: 1 }));
    await act(() => first.send({ v: 5, type: 'crocGuessed', round: 1, turnNo: 0 }));
    expect(saved().phase).toBe('running');

    await act(() => first.send({ v: 5, type: 'crocGuessed', round: 1, turnNo: 1 }));
    await act(() => first.send({ v: 5, type: 'crocGuessed', round: 1, turnNo: 1 }));
    expect(saved()).toMatchObject({ phase: 'result', totals: { guessed: 1, turns: 1 } });
    expect(screen.getByTestId('croc.result')).toHaveTextContent(/^Guessed!The word: /);
    expect(qaEvents()).toContainEqual({ event: 'croc_turn_end', turnNo: 1, kind: 'guessed' });

    await play(30000, [first, second]);
    expect(saved().totals).toEqual({ guessed: 1, skipped: 0, turns: 1 });
    expect(saved().phase).toBe('pick');
  });
});

describe('campfire-crocodile — describer leaves (AC6)', () => {
  it('AC6: the describer dropping cancels the turn on every phone; turns stay 0; the seat is pickable after it rejoins', async () => {
    const [first, second] = await runningTurn();
    await act(() => first.drop());
    expect(lastGame(second)).toMatchObject({
      phase: 'result',
      public: { result: { kind: 'cancelled', name: 'guest_1' }, totals: { turns: 0 } },
    });
    expect(screen.getByTestId('croc.result')).toHaveTextContent(/^guest_1 left — the word is not counted/);
    expect(qaEvents()).toContainEqual({ event: 'croc_turn_end', turnNo: 1, kind: 'cancelled' });

    await fireEvent.press(screen.getByTestId('croc.next'));
    expect(screen.queryByTestId('croc.pick.p1')).not.toBeOnTheScreen();
    expect(screen.getByTestId('croc.pick.p2')).toBeOnTheScreen();

    const welcome = first.received().find(message => message.type === 'welcome') as
      | { seatToken: string; room: { code: string } }
      | undefined;
    const back = fakeNet.server().connect();
    await act(() =>
      back.send({
        v: 5,
        type: 'hello',
        code: welcome?.room.code,
        nickname: 'guest_1',
        avatar: 'bear',
        seatToken: welcome?.seatToken,
      }),
    );
    expect(screen.getByTestId('croc.pick.p1')).toBeOnTheScreen();
    expect(lastGame(back)).toMatchObject({ phase: 'pick', public: { totals: { turns: 0 } } });
  });
});

describe('campfire-crocodile — end and summary (AC7)', () => {
  it('AC7: the host ends after confirming; every phone shows the totals; Play again starts over', async () => {
    const [first] = await runningTurn();
    await act(() => first.send({ v: 5, type: 'crocGuessed', round: 1, turnNo: 1 }));

    await fireEvent.press(screen.getByTestId('croc.end'));
    expect(screen.getByText('End the game?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('camp.game.end-confirm'));
    expect(lastGame(first)).toMatchObject({ phase: 'ended', public: { totals: { guessed: 1, turns: 1 } } });
    expect(screen.getByTestId('croc.summary.totals')).toHaveTextContent('Words guessed 1 · Skipped 0 · Turns 1');
    expect(qaEvents()).toContainEqual({ event: 'camp_game_ended', game: 'croc', guessed: 1, skipped: 0, turns: 1 });
    expect(screen.queryByTestId('croc.end')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('croc.play-again'));
    expect(saved()).toMatchObject({ phase: 'pick', turnNo: 0, totals: { guessed: 0, skipped: 0, turns: 0 } });
    expect(lastGame(first)).toMatchObject({ phase: 'pick' });
  });
});
