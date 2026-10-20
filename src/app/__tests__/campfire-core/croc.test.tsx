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
  jest.restoreAllMocks();
  await tearDownApp(http);
});

async function join(nickname: string): Promise<FakeSocket> {
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v: 5, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

async function openCrocLobby() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'croc' });
  });
  await screen.findByTestId('camp.lobby.code');
}

/** Host + guest_1 (p1) + guest_2 (p2), Crocodile started at "who shows next?". */
async function startCroc(): Promise<[FakeSocket, FakeSocket]> {
  await openCrocLobby();
  const players: [FakeSocket, FakeSocket] = [await join('guest_1'), await join('guest_2')];
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('croc.pick');
  return players;
}

const ofType = (socket: FakeSocket, type: string) =>
  socket.received().filter(message => message.type === type);

function saved(): CrocState {
  const room: { game: CrocState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}

describe('campfire-crocodile — lobby (AC1)', () => {
  it('AC1: Start needs 3 players incl. the host; the last pack cannot be unticked; timer defaults to 60 s', async () => {
    await openCrocLobby();
    expect(screen.getByTestId('camp.lobby.game.croc')).toBeSelected();
    expect(screen.getByTestId('croc.settings.timer.60')).toBeSelected();
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    expect(screen.getByTestId('camp.lobby.start-reason')).toHaveTextContent('Crocodile needs 3+ players');

    await fireEvent.press(screen.getByTestId('croc.settings.pack.croc-animals'));
    await fireEvent.press(screen.getByTestId('croc.settings.pack.croc-heroes'));
    await fireEvent.press(screen.getByTestId('croc.settings.pack.croc-famous'));
    expect(screen.getByTestId('croc.settings.pack.croc-famous')).toBeChecked();
    expect(screen.getByTestId('croc.settings.pack.croc-animals')).not.toBeChecked();

    await join('guest_1');
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    await join('guest_2');
    expect(screen.getByTestId('camp.lobby.start')).toBeEnabled();
    expect(screen.queryByTestId('camp.lobby.start-reason')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('croc.settings.timer.90'));
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));
    await screen.findByTestId('croc.pick');
    expect(saved()).toMatchObject({ phase: 'pick', turnNo: 0, durationSec: 90, packs: ['croc-famous'] });
    expect(qaEvents()).toContainEqual({ event: 'camp_game_started', game: 'croc', players: 3 });
  });
});

describe('campfire-crocodile — pick and secret word (AC2, AC3)', () => {
  it('AC2/AC3: the host picks a player; only that phone gets the word, the broadcast never carries it', async () => {
    const [first, second] = await startCroc();
    expect(ofType(first, 'game').at(-1)).toMatchObject({ game: 'croc', phase: 'pick' });
    ['host', 'p1', 'p2'].forEach(seat => expect(screen.getByTestId(`croc.pick.${seat}`)).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('croc.pick.p1'));
    const { word } = saved();
    expect(word).toBeDefined();
    expect(ofType(first, 'deal').at(-1)).toMatchObject({
      game: 'croc',
      secret: { word: word?.id, pack: word?.pack, turnNo: 1 },
    });
    expect(ofType(second, 'deal')).toHaveLength(0);
    const seen = ofType(second, 'game').at(-1);
    expect(seen).toMatchObject({ phase: 'ready', public: { turnNo: 1, describerSeatId: 'p1' } });
    expect(JSON.stringify(seen)).not.toContain(String(word?.id));
    expect(screen.getByTestId('croc.showing')).toHaveTextContent('guest_1 is showing');
    expect(screen.queryByTestId('croc.card')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'croc_pick', turnNo: 1 });
  });

  it('AC3: describer Skip draws a new word and counts; stale turn or non-describer messages are ignored; Start runs', async () => {
    const [first, second] = await startCroc();
    await fireEvent.press(screen.getByTestId('croc.pick.p1'));
    const before = saved().word;

    await act(() => first.send({ v: 5, type: 'crocSkip', round: 1, turnNo: 0 }));
    await act(() => second.send({ v: 5, type: 'crocSkip', round: 1, turnNo: 1 }));
    await act(() => second.send({ v: 5, type: 'crocStart', round: 1, turnNo: 1 }));
    expect(saved()).toMatchObject({ phase: 'ready', word: before, totals: { skipped: 0 } });

    await act(() => first.send({ v: 5, type: 'crocSkip', round: 1, turnNo: 1 }));
    const after = saved();
    expect(after.totals.skipped).toBe(1);
    expect(after.word).not.toEqual(before);
    expect(ofType(first, 'deal').at(-1)).toMatchObject({ secret: { word: after.word?.id, turnNo: 1 } });
    expect(qaEvents()).toContainEqual({ event: 'croc_skip', turnNo: 1, pack: before?.pack });

    await act(() => first.send({ v: 5, type: 'crocStart', round: 1, turnNo: 1 }));
    expect(saved().phase).toBe('running');
    expect(ofType(second, 'game').at(-1)).toMatchObject({ phase: 'running' });
  });

  it('AC3: the host as describer holds the card to see the word, skips and starts on this phone', async () => {
    const [first] = await startCroc();
    await fireEvent.press(screen.getByTestId('croc.pick.host'));
    expect(ofType(first, 'deal')).toHaveLength(0);
    expect(screen.getByTestId('croc.rule')).toHaveTextContent("Show it, don't say it — no words, no sounds");
    expect(screen.queryByTestId('croc.word')).not.toBeOnTheScreen();
    await fireEvent(screen.getByTestId('camp.secret.card'), 'pressIn');
    expect(screen.getByTestId('croc.word')).not.toHaveTextContent('');
    await fireEvent(screen.getByTestId('camp.secret.card'), 'pressOut');
    expect(secure.setSecure).toHaveBeenCalledWith(true);

    await fireEvent.press(screen.getByTestId('croc.skip'));
    expect(saved().totals.skipped).toBe(1);
    await fireEvent.press(screen.getByTestId('croc.start'));
    expect(saved().phase).toBe('running');
    expect(screen.queryByTestId('croc.start')).not.toBeOnTheScreen();
    expect(screen.getByTestId('croc.card')).toBeOnTheScreen();
  });
});
