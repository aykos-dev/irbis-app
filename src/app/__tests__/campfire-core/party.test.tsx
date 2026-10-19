import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { gameReducer } from '../../../features/campfire-core/games/gameReducer';
import { saveHostRoom } from '../../../features/campfire-core/room/hostRoomStore';
import {
  createRoom,
  roomReducer,
} from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';

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
  await tearDownApp(http);
});

async function openLobby(params?: { game?: 'imposter' | 'whoami' | 'rather' }) {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', params);
  });
  await screen.findByTestId('camp.lobby.chip');
}

let roomCode = '';
function code(): string {
  const shown = screen.queryByTestId('camp.lobby.code');
  if (shown) {
    roomCode = String(shown.props.children);
  }
  return roomCode;
}

async function join(nickname: string, seatToken?: string): Promise<FakeSocket> {
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({
      v: 2,
      type: 'hello',
      code: code(),
      nickname,
      avatar: 'bear',
      ...(seatToken ? { seatToken } : {}),
    });
  });
  return client;
}

const types = (client: FakeSocket) => client.received().map(message => message.type);

describe('campfire-party — lobby picker (AC1)', () => {
  it('AC1: Imposter is preselected with its settings; Start is disabled below 3 players with the reason', async () => {
    await openLobby();

    expect(screen.getByTestId('camp.lobby.game.imposter')).toBeSelected();
    expect(screen.getByTestId('camp.lobby.game.imposter')).not.toHaveTextContent(/Coming soon/);
    expect(screen.getByTestId('camp.lobby.game.mafia')).toHaveTextContent(/Coming soon/);
    expect(screen.getByTestId('camp.lobby.pack')).toHaveTextContent(/Word pack.*Animals · 60 words/);
    expect(screen.getByTestId('camp.lobby.imposters')).toHaveTextContent(/Imposters.*1/);
    expect(screen.getByTestId('camp.lobby.sees-category').props.value).toBe(true);
    expect(screen.getByText('Makes bluffing easier')).toBeOnTheScreen();
    expect(
      screen.getByText('You play too — your word stays hidden on this phone.'),
    ).toBeOnTheScreen();

    const startButton = screen.getByTestId('camp.lobby.start');
    expect(startButton).toHaveTextContent('Start Imposter');
    expect(startButton).toBeDisabled();
    expect(screen.getByTestId('camp.lobby.start-reason')).toHaveTextContent('Needs 3+ players');

    await join('guest_1');
    await fireEvent.press(screen.getByTestId('camp.lobby.game.rather'));
    expect(screen.getByTestId('camp.lobby.start')).toHaveTextContent('Start Would you rather');
    expect(screen.getByTestId('camp.lobby.start')).toBeEnabled();
    expect(screen.queryByTestId('camp.lobby.start-reason')).not.toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.pack')).toHaveTextContent(/Pack.*Camping · 40 questions/);
    expect(screen.queryByTestId('camp.lobby.imposters')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('camp.lobby.game.whoami'));
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    expect(screen.getByTestId('camp.lobby.start-reason')).toHaveTextContent('Needs 3+ players');
  });

  it('AC1: the pack sheet changes the pack; a CampHub game tile opens the Host flow with that game', async () => {
    await openLobby();
    await fireEvent.press(screen.getByTestId('camp.lobby.pack'));
    await fireEvent.press(await screen.findByTestId('camp.lobby.pack.imposter-food'));
    expect(screen.getByTestId('camp.lobby.pack')).toHaveTextContent(/Food · 60 words/);
    expect(screen.queryByTestId('camp.lobby.pack-sheet')).not.toBeOnTheScreen();

    await act(() => {
      navigationRef.navigate('MainTabs');
    });
    await openTab('community');
    expect(screen.getByTestId('camp.hub.game.whoami')).not.toHaveTextContent(/Coming soon/);
    await fireEvent.press(screen.getByTestId('camp.hub.game.whoami'));
    await fireEvent.press(await screen.findByTestId('camp.player.continue'));
    expect(await screen.findByTestId('camp.lobby.start')).toHaveTextContent('Start Who am I?');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ game: 'whoami' });
  });
});

describe('campfire-party — start, late join, end, resume (AC2)', () => {
  it('AC2: Start deals per seat and opens the game route; a late joiner only gets the round; End game → lobby for all', async () => {
    await openLobby();
    const first = await join('guest_1');
    const second = await join('guest_2');
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));

    expect(await screen.findByTestId('camp.game.waiting')).toBeOnTheScreen();
    expect(screen.getByText('Imposter')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_game_started', game: 'imposter', players: 3 });
    expect(qaEvents()).toContainEqual({ event: 'camp_round_started', game: 'imposter', round: 1 });
    [first, second].forEach(client => {
      expect(types(client).slice(-2)).toEqual(['deal', 'game']);
    });
    const saved = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
    expect(saved.game).toMatchObject({ game: 'imposter', round: 1, players: ['host', 'p1', 'p2'] });
    const wordId: unknown = Object.values<{ wordId?: string }>(saved.game.deals).find(
      deal => deal.wordId,
    )?.wordId;
    const broadcast = first.received().find(message => message.type === 'game');
    expect(JSON.stringify(broadcast)).not.toContain(String(wordId));

    const late = await join('guest_3');
    expect(types(late)).toEqual(['welcome', 'roster', 'game']);
    expect(late.received().at(-1)).toMatchObject({ public: { waiting: ['p3'] } });

    await fireEvent.press(screen.getByTestId('camp.game.end'));
    expect(await screen.findByTestId('camp.game.end-sheet')).toHaveTextContent(
      /End the game for everyone\?/,
    );
    await fireEvent.press(screen.getByTestId('camp.game.end-confirm'));

    expect(await screen.findByTestId('camp.lobby.start')).toBeOnTheScreen();
    expect(navigationRef.getCurrentRoute()?.name).toBe('CampLobby');
    [first, second, late].forEach(client => {
      expect(client.received().at(-1)).toEqual({ v: 2, type: 'lobby' });
    });
    expect(qaEvents()).toContainEqual({ event: 'camp_game_ended', game: 'imposter', rounds: 1 });
    expect(JSON.parse(storage.getString('camp.hostRoom') ?? '{}').game).toBeNull();
  });

  it('AC2: resume restores the round; the reconnecting seat gets the same deal back', async () => {
    let room = createRoom('4821', { nickname: 'guest_0', avatar: 'fox' });
    ['guest_1', 'guest_2'].forEach((nickname, index) => {
      room = roomReducer(room, {
        type: 'hello',
        connId: `c${index}`,
        hello: { v: 2, type: 'hello', code: '4821', nickname, avatar: 'bear' },
        seatToken: `seat_token_${index + 1}`,
      }).state;
    });
    const game = gameReducer(null, {
      type: 'start',
      game: 'whoami',
      settings: { packId: 'whoami-famous', imposters: 1, showCategory: true },
      seats: room.seats.map(seat => ({ seatId: seat.seatId, connected: true })),
      ids: ['amir-temur', 'ulugh-beg', 'babur'],
      rng: () => 0,
    });
    saveHostRoom(room, Date.now(), game);

    await renderApp();
    await openTab('community');
    await fireEvent.press(await screen.findByTestId('camp.hub.resume'));
    expect(await screen.findByTestId('camp.game.waiting')).toBeOnTheScreen();
    expect(screen.getByText('Who am I?')).toBeOnTheScreen();

    const back = fakeNet.server().connect();
    await act(() => {
      back.send({
        v: 2,
        type: 'hello',
        code: '4821',
        nickname: 'guest_1',
        avatar: 'bear',
        seatToken: 'seat_token_1',
      });
    });
    expect(back.received().find(message => message.type === 'deal')).toEqual({
      v: 2,
      type: 'deal',
      game: 'whoami',
      round: 1,
      secret: game?.deals.p1,
    });
  });
});
