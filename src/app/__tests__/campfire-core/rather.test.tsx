import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import type { GameState } from '../../../features/campfire-core/games/gameReducer';
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
    client.send({ v: 4, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

/** Host + guest_1 (p1) + guest_2 (p2), Would you rather started. */
async function startRather() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'rather' });
  });
  await screen.findByTestId('camp.lobby.code');
  const players = [await join('guest_1'), await join('guest_2')];
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('wyr.screen');
  return players as [FakeSocket, FakeSocket];
}

const lastGame = (socket: FakeSocket) =>
  socket
    .received()
    .filter(message => message.type === 'game')
    .at(-1);

async function vote(socket: FakeSocket, pick: 'a' | 'b', qIndex = 0) {
  await act(() => socket.send({ v: 4, type: 'wyrVote', round: 1, qIndex, pick }));
}

describe('campfire-party — Would you rather (AC7)', () => {
  it('AC7: before the reveal only the count shows, on this phone and in what players receive', async () => {
    const [first, second] = await startRather();
    expect(screen.getByText(/· question 1 of 20/)).toBeOnTheScreen();
    expect(screen.getByTestId('wyr.voted')).toHaveTextContent('0 / 3 voted');

    await vote(first, 'a');
    expect(screen.getByTestId('wyr.voted')).toHaveTextContent('1 / 3 voted');
    expect(screen.queryByText(/%$/)).not.toBeOnTheScreen();
    expect(screen.queryByText('Your pick')).not.toBeOnTheScreen();
    const seen = lastGame(second);
    expect(seen).toMatchObject({ phase: 'voting', public: { voted: ['p1'] } });
    expect(JSON.stringify(seen)).not.toMatch(/"picks"|"tally"|"a"/);
  });

  it('AC7: tapping the other option changes the vote; all connected votes reveal by themselves', async () => {
    const [first, second] = await startRather();
    await fireEvent.press(screen.getByTestId('wyr.option.a'));
    expect(screen.getByTestId('wyr.option.a')).toBeSelected();
    await fireEvent.press(screen.getByTestId('wyr.option.b'));
    expect(screen.getByTestId('wyr.option.b')).toBeSelected();
    expect(screen.getByTestId('wyr.option.a')).not.toBeSelected();
    expect(screen.getByTestId('wyr.voted')).toHaveTextContent('1 / 3 voted');

    await vote(first, 'b');
    expect(screen.getByTestId('wyr.reveal')).toBeOnTheScreen();
    await vote(second, 'a');
    expect(screen.queryByTestId('wyr.reveal')).not.toBeOnTheScreen();
    expect(screen.getByTestId('wyr.option.b')).toHaveTextContent(/Your pick.*67%/);
    expect(screen.getByTestId('wyr.option.a')).toHaveTextContent(/33%/);
    expect(qaEvents()).toContainEqual({ event: 'camp_wyr_revealed', votes: 3, forced: false });
    expect(lastGame(first)).toMatchObject({ phase: 'revealed', public: { picks: { host: 'b', p1: 'b', p2: 'a' } } });
    expect(screen.getByTestId('wyr.defend')).toHaveTextContent('guest_2 — defend your choice!');
  });

  it('AC7: the host forces the reveal; a tie has no defend line', async () => {
    const [first] = await startRather();
    await fireEvent.press(screen.getByTestId('wyr.option.a'));
    await vote(first, 'b');
    await fireEvent.press(screen.getByTestId('wyr.reveal'));
    expect(qaEvents()).toContainEqual({ event: 'camp_wyr_revealed', votes: 2, forced: true });
    expect(screen.getByTestId('wyr.option.a')).toHaveTextContent(/50%/);
    expect(screen.queryByTestId('wyr.defend')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('wyr.option.b'));
    expect(screen.getByTestId('wyr.option.a')).toBeSelected();
  });

  it('AC7: after question 20 the round is done; New round starts 20 new questions', async () => {
    const [first] = await startRather();
    const questions = saved().questions;
    for (let i = 0; i < 19; i += 1) {
      await fireEvent.press(screen.getByTestId('wyr.reveal'));
      await fireEvent.press(screen.getByTestId('wyr.next'));
    }
    expect(screen.getByText(/· question 20 of 20/)).toBeOnTheScreen();
    expect(lastGame(first)).toMatchObject({ public: { qIndex: 19 } });
    await fireEvent.press(screen.getByTestId('wyr.reveal'));
    expect(screen.queryByTestId('wyr.next')).not.toBeOnTheScreen();
    expect(screen.getByTestId('wyr.done')).toHaveTextContent('Pack round done');

    await fireEvent.press(screen.getByTestId('wyr.new-round'));
    expect(screen.getByText(/· question 1 of 20/)).toBeOnTheScreen();
    const next = saved().questions;
    expect(next).toHaveLength(20);
    next.forEach(id => expect(questions).not.toContain(id));
  });
});

function saved(): GameState {
  const room: { game: GameState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}
