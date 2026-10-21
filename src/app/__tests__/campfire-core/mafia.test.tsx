import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import {
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { storage } from '../../../shared/storage';
import { campNet } from '../../../features/campfire-core/native/campNet';

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

async function openMafiaLobby() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'mafia' });
  });
  await screen.findByTestId('maf.setup');
}

let shownCode = '';
/** The room code (remembered once the lobby is covered by the game route). */
function roomCode(): string {
  const shown = screen.queryByTestId('camp.lobby.code');
  if (shown) {
    shownCode = String(shown.props.children);
  }
  return shownCode;
}

async function join(nickname: string, seatToken?: string, v = 4): Promise<FakeSocket> {
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({
      v,
      type: 'hello',
      code: roomCode(),
      nickname,
      avatar: 'bear',
      ...(seatToken ? { seatToken } : {}),
    });
  });
  return client;
}

async function joinPlayers(n: number): Promise<FakeSocket[]> {
  const clients: FakeSocket[] = [];
  for (let i = 1; i <= n; i += 1) {
    clients.push(await join(`guest_${i}`));
  }
  return clients;
}

const count = (id: string) => screen.getByTestId(`maf.role.${id}.count`);
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const dealsOf = (client: FakeSocket) =>
  client.received().filter(message => message.type === 'deal');

describe('campfire-mafia — host setup (AC1)', () => {
  it('AC1: n excludes the host; defaults, Civilian = n − specials, balance summary and the disabled reasons', async () => {
    await openMafiaLobby();
    expect(screen.getByTestId('camp.lobby.game.mafia')).toBeSelected();
    expect(screen.getByText('Mafia · host setup')).toBeOnTheScreen();
    expect(screen.getByText('Choose roles')).toBeOnTheScreen();
    expect(screen.getByText('0 players')).toBeOnTheScreen();
    expect(screen.getByTestId('maf.deal')).toBeDisabled();
    expect(screen.getByTestId('maf.deal-reason')).toHaveTextContent('Needs 5+ players besides the host');

    await joinPlayers(6);
    expect(screen.getByText('6 players')).toBeOnTheScreen();
    expect(count('boss')).toHaveTextContent('1');
    expect(count('mafia')).toHaveTextContent('1');
    expect(count('detective')).toHaveTextContent('1');
    expect(count('doctor')).toHaveTextContent('1');
    expect(count('maniac')).toHaveTextContent('0');
    expect(count('civilian')).toHaveTextContent('2');
    expect(screen.queryByTestId('maf.role.civilian.plus')).not.toBeOnTheScreen();
    expect(screen.getByTestId('maf.balance')).toHaveTextContent('6 / 6 roles · balanced');
    expect(screen.getByText('Town 4 · Mafia 2 · Solo 0')).toBeOnTheScreen();
    expect(screen.getByTestId('maf.deal')).toBeEnabled();
    expect(screen.queryByTestId('maf.deal-reason')).not.toBeOnTheScreen();

    await press('maf.role.mafia.plus');
    expect(screen.getByTestId('maf.balance')).toHaveTextContent('6 / 6 roles · mafia heavy');
    await press('maf.role.lover.plus');
    await press('maf.role.maniac.plus');
    expect(count('civilian')).toHaveTextContent('0');
    expect(screen.getByTestId('maf.balance')).toHaveTextContent('7 / 6 roles · mafia heavy');
    expect(screen.getByTestId('maf.deal-reason')).toHaveTextContent('Too many roles');

    await press('maf.role.lover.minus');
    await press('maf.role.maniac.minus');
    await press('maf.role.boss.minus');
    await press('maf.role.mafia.minus');
    await press('maf.role.mafia.minus');
    expect(screen.getByTestId('maf.role.mafia.minus')).toBeDisabled();
    expect(screen.getByTestId('maf.deal-reason')).toHaveTextContent('Add at least 1 mafia');
  });

  it('AC1: the last counts and the reveal toggle are reused (clamped to n) and saved on change', async () => {
    storage.setString(
      'camp.maf.setup',
      JSON.stringify({
        counts: { boss: 1, mafia: 9, detective: 1, doctor: 0, maniac: 0, lover: 0, bodyguard: 0, sniper: 0, journalist: 0, immortal: 1 },
        revealOut: false,
      }),
    );
    await openMafiaLobby();
    expect(screen.getByTestId('maf.reveal-out').props.value).toBe(false);
    await joinPlayers(5);
    expect(count('mafia')).toHaveTextContent('5');
    expect(count('immortal')).toHaveTextContent('1');
    expect(count('doctor')).toHaveTextContent('0');
    expect(screen.getByTestId('maf.role.mafia.plus')).toBeDisabled();

    await press('maf.role.mafia.minus');
    await fireEvent(screen.getByTestId('maf.reveal-out'), 'valueChange', true);
    expect(JSON.parse(storage.getString('camp.maf.setup') ?? '{}')).toEqual({
      counts: { boss: 1, mafia: 4, detective: 1, doctor: 0, maniac: 0, lover: 0, bodyguard: 0, sniper: 0, journalist: 0, immortal: 1 },
      revealOut: true,
    });
  });
});

describe('campfire-mafia — deal (AC2)', () => {
  it('AC2: each player gets only its own role, the host none; night 1 public state; QA events', async () => {
    await openMafiaLobby();
    const clients = await joinPlayers(6);
    await press('maf.role.maniac.plus');
    await press('maf.deal');

    expect(await screen.findByTestId('camp.game.waiting')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_game_started', game: 'mafia', players: 6 });
    expect(qaEvents()).toContainEqual({ event: 'maf_dealt', players: 6, mafia: 2, town: 3, solo: 1 });

    const saved = JSON.parse(storage.getString('camp.hostRoom') ?? '{}').game;
    expect(saved).toMatchObject({ game: 'mafia', round: 1, players: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] });
    expect(saved.deals.host).toBeUndefined();
    const roles = clients.map((client, i) => {
      const deals = dealsOf(client);
      expect(deals).toHaveLength(1);
      expect(deals[0]).toEqual({
        v: 4,
        type: 'deal',
        game: 'mafia',
        round: 1,
        secret: saved.deals[`p${i + 1}`],
      });
      expect(client.received().at(-1)).toEqual({
        v: 4,
        type: 'game',
        game: 'mafia',
        round: 1,
        phase: { kind: 'night', n: 1 },
        public: {
          phase: { kind: 'night', n: 1 },
          readyCount: 0,
          playerCount: 6,
          out: [],
          revealOut: true,
        },
      });
      return saved.deals[`p${i + 1}`].roleId;
    });
    expect(roles.sort()).toEqual(['boss', 'civilian', 'detective', 'doctor', 'mafia', 'maniac']);

    await press('camp.game.end');
    await press('camp.game.end-confirm');
    await screen.findByTestId('maf.over');
    await press('maf.lobby');
    expect(await screen.findByTestId('maf.setup')).toBeOnTheScreen();
    clients.forEach(client => expect(client.received().at(-1)).toEqual({ v: 4, type: 'lobby' }));
  });

  it('AC2: reconnect → same role; mid-game joiner waits; leaving puts the seat out (exiled); a v2 phone is rejected', async () => {
    await openMafiaLobby();
    const clients = await joinPlayers(5);
    await press('maf.deal');
    await screen.findByTestId('camp.game.waiting');
    const first = clients[0];
    if (!first) {
      throw new Error('no client');
    }
    const token = String(first.received()[0]?.seatToken);
    const ownDeal = dealsOf(first)[0];

    await act(() => {
      first.destroy();
    });
    const back = await join('guest_1', token);
    expect(dealsOf(back)).toEqual([ownDeal]);

    const late = await join('guest_9');
    expect(late.received().map(message => message.type)).toEqual(['welcome', 'roster', 'game']);

    await act(() => clients[1]?.send({ v: 4, type: 'leave' }));
    expect(back.received().at(-1)).toMatchObject({
      type: 'game',
      public: { out: [{ seatId: 'p2', reason: 'exiled', phase: { kind: 'night', n: 1 } }] },
    });

    const old = await join('guest_old', undefined, 2);
    expect(old.received()).toEqual([{ v: 4, type: 'rejected', reason: 'version' }]);
  });
});
