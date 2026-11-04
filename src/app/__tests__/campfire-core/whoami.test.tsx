import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import type { GameState } from '../../../features/campfire-core/games/gameReducer';
import { findPack } from '../../../features/campfire-core/games/packs';
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

function saved(): GameState {
  const room: { game: GameState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}

/** The character a seat holds, read from another seat's deal, in English. */
function characterOf(seatId: string): string {
  const game = saved();
  const id = Object.values(game.deals)
    .flatMap(dealt => ('others' in dealt ? dealt.others : []))
    .find(other => other.seatId === seatId)?.characterId;
  const pack = findPack(game.settings.packId);
  const item = pack && pack.game === 'whoami' ? pack.items.find(entry => entry.id === id) : undefined;
  return item?.en ?? '';
}

async function join(nickname: string): Promise<FakeSocket> {
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v: 5, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

/** Host + guest_1 (p1) + guest_2 (p2), Who am I started. */
async function startWhoami() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'whoami' });
  });
  await screen.findByTestId('camp.lobby.code');
  const players = [await join('guest_1'), await join('guest_2')];
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('whoami.screen');
  return players;
}

const lastDeal = (socket: FakeSocket | undefined) =>
  socket
    ?.received()
    .filter(message => message.type === 'deal')
    .at(-1);

/** Character names can contain regex characters, e.g. "Ibn Sina (Avicenna)". */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('campfire-party — Who am I (AC6)', () => {
  it('AC6: own character absent before showMine; every other player listed with their character; secure screen on', async () => {
    await startWhoami();
    expect(screen.getByText('Who am I?')).toBeOnTheScreen();
    expect(screen.getByText(/Pack: .* · 3 players/)).toBeOnTheScreen();
    expect(screen.getByTestId('whoami.own')).toHaveTextContent(/\?.*YOU · guest_0.*Your character is hidden on your phone/);
    expect(screen.queryByText(characterOf('host'))).not.toBeOnTheScreen();
    expect(screen.getByTestId('whoami.player.p1')).toHaveTextContent(new RegExp(`guest_1.*${escapeRegExp(characterOf('p1'))}`));
    expect(screen.getByTestId('whoami.player.p2')).toHaveTextContent(new RegExp(`guest_2.*${escapeRegExp(characterOf('p2'))}`));
    expect(screen.queryByTestId('whoami.player.host')).not.toBeOnTheScreen();
    expect(screen.getByText('Only they can\'t see it')).toBeOnTheScreen();
    expect(secure.setSecure).toHaveBeenLastCalledWith(true);
  });

  it('AC6: showMine reveals the character only to that seat; the host confirms and holds to see its own', async () => {
    const [first, second] = await startWhoami();
    const secondDeals = second?.received().filter(message => message.type === 'deal').length;

    await act(() => first?.send({ v: 5, type: 'showMine', round: 1 }));
    expect(lastDeal(first)).toMatchObject({ type: 'deal', round: 1, secret: { mine: expect.any(String) } });
    expect(second?.received().filter(message => message.type === 'deal')).toHaveLength(secondDeals ?? 0);
    expect(lastDeal(second)).not.toHaveProperty('secret.mine');
    expect(screen.getByTestId('whoami.own')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_whoami_show_mine', round: 1 });

    await fireEvent.press(screen.getByTestId('whoami.show-mine'));
    expect(await screen.findByTestId('whoami.show-sheet')).toHaveTextContent(/Show your character\?/);
    await fireEvent.press(screen.getByTestId('whoami.show-confirm'));
    expect(screen.queryByTestId('whoami.own')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('whoami.show-mine')).not.toBeOnTheScreen();
    expect(screen.queryByText(characterOf('host'))).not.toBeOnTheScreen();
    await fireEvent(screen.getByTestId('camp.secret.card'), 'pressIn');
    expect(screen.getByTestId('whoami.mine')).toHaveTextContent(characterOf('host'), { exact: false });
    await fireEvent(screen.getByTestId('camp.secret.card'), 'pressOut');
    expect(screen.queryByTestId('whoami.mine')).not.toBeOnTheScreen();
  });

  it('AC6: New round deals new characters to everyone and clears the shown one', async () => {
    const [first] = await startWhoami();
    const before = ['p1', 'p2', 'host'].map(characterOf);
    await fireEvent.press(screen.getByTestId('whoami.show-mine'));
    await fireEvent.press(await screen.findByTestId('whoami.show-confirm'));

    await fireEvent.press(screen.getByTestId('whoami.new-round'));
    expect(screen.getByTestId('whoami.own')).toBeOnTheScreen();
    expect(screen.getByTestId('whoami.show-mine')).toBeOnTheScreen();
    const after = ['p1', 'p2', 'host'].map(characterOf);
    after.forEach(name => expect(before).not.toContain(name));
    expect(lastDeal(first)).toMatchObject({ round: 2 });
    expect(lastDeal(first)).not.toHaveProperty('secret.mine');
  });
});
