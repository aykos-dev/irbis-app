import { act, fireEvent, screen, within } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';

import { fakeCamera, fakeNet, fakeWifi, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import type { HostGame } from '../../../features/campfire-core/games/gameReducer';
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
const haptic = jest.mocked(HapticFeedback.trigger);

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
const row = (seatId: string) => within(screen.getByTestId(`maf.player.${seatId}`));
const lastGame = (client: FakeSocket) =>
  client.received().filter(message => message.type === 'game').at(-1);

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

describe('campfire-mafia — narrator control (AC4)', () => {
  it('AC4: the host sees every role, team counts and Night 1 ready ticks; players never get another seat\'s role', async () => {
    const clients = await hostMafia();
    expect(screen.queryByTestId('maf.card')).not.toBeOnTheScreen();
    expect(screen.getByText('Mafia · narrator')).toBeOnTheScreen();
    expect(screen.getByText('Night 1')).toBeOnTheScreen();
    expect(screen.getByText('Alive 6 / 6 · Mafia 2 · Town 4 · Solo 0')).toBeOnTheScreen();
    expect(row('p1').getByText('Mafia Boss')).toBeOnTheScreen();
    expect(row('p2').getByText('Mafia')).toBeOnTheScreen();
    expect(row('p3').getByText('Detective')).toBeOnTheScreen();
    expect(row('p6').getByText('Civilian')).toBeOnTheScreen();
    expect(row('p1').getByText('alive')).toBeOnTheScreen();
    expect(row('p1').queryByText('Ready')).not.toBeOnTheScreen();

    await act(() => clients[0]?.send({ v: 4, type: 'mafReady', round: 1 }));
    await act(() => clients[0]?.send({ v: 4, type: 'mafReady', round: 1 }));
    expect(row('p1').getByText('Ready')).toBeOnTheScreen();
    expect(qaEvents().filter(entry => entry.event === 'maf_ready')).toEqual([
      { event: 'maf_ready', ready: 1, players: 6 },
    ]);
    expect(lastGame(clients[1] as FakeSocket)).toMatchObject({ public: { readyCount: 1, playerCount: 6 } });

    // Each phone's only role is its own deal.
    clients.forEach(client => {
      const roleIds = JSON.stringify(client.received()).match(/"roleId":"\w+"/g) ?? [];
      expect(roleIds).toHaveLength(1);
      expect(client.received().filter(message => message.type === 'deal')).toHaveLength(1);
    });
  });

  it('AC4: the sheet offers Killed at night, Exiled by day, only Back for an out player; the phase button steps', async () => {
    const clients = await hostMafia();

    await press('maf.player.p1');
    expect(screen.getByTestId('maf.sheet.killed')).toBeOnTheScreen();
    expect(screen.queryByTestId('maf.sheet.exiled')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('maf.sheet.back')).not.toBeOnTheScreen();
    await press('maf.sheet.killed');
    expect(row('p1').getByText('killed · Night 1')).toBeOnTheScreen();
    expect(screen.getByText('Alive 5 / 6 · Mafia 1 · Town 4 · Solo 0')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'maf_out', reason: 'killed', phase: 'night' });
    expect(lastGame(clients[1] as FakeSocket)).toMatchObject({
      public: { out: [{ seatId: 'p1', reason: 'killed', phase: { kind: 'night', n: 1 }, roleId: 'boss' }] },
    });

    expect(screen.getByTestId('maf.phase-next')).toHaveTextContent('Start Day 1');
    await press('maf.phase-next');
    expect(screen.getByText('Day 1')).toBeOnTheScreen();
    expect(screen.getByTestId('maf.phase-next')).toHaveTextContent('Start Night 2');
    expect(qaEvents()).toContainEqual({ event: 'maf_phase', kind: 'day', n: 1 });

    await press('maf.player.p2');
    expect(screen.getByTestId('maf.sheet.exiled')).toBeOnTheScreen();
    expect(screen.queryByTestId('maf.sheet.killed')).not.toBeOnTheScreen();
    await press('maf.sheet.cancel');

    await press('maf.player.p1');
    expect(screen.getByTestId('maf.sheet.back')).toBeOnTheScreen();
    expect(screen.queryByTestId('maf.sheet.exiled')).not.toBeOnTheScreen();
    await press('maf.sheet.back');
    expect(row('p1').getByText('alive')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'maf_back' });
    expect(lastGame(clients[1] as FakeSocket)).toMatchObject({ public: { out: [] } });

    await press('maf.phase-next');
    expect(screen.getByText('Night 2')).toBeOnTheScreen();
    expect(screen.getByTestId('camp.game.end')).toBeOnTheScreen();
  });
});

describe('campfire-mafia — player phone (AC3, AC5)', () => {
  const HOST_IP = '192.168.49.1';
  const wifi = { ssid: 'DIRECT-irbis', password: 'pw_1' };

  beforeEach(() => {
    jest.useFakeTimers();
    fakeCamera.reset();
    fakeWifi.reset();
    net.getWifiIp.mockResolvedValue('192.168.49.23');
    storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_1', animal: 'bear' }));
  });

  /** This phone joins first (p1 = Mafia Boss, no shuffle), then guest_2..guest_5. */
  async function playMafia() {
    let game: HostGame | null = null;
    const server = createHostServer({
      room: createRoom('4821', { nickname: 'guest_0', avatar: 'fox' }),
      network: wifi.ssid,
      onChange: (_room, next) => {
        game = next;
      },
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
    await act(() => server.startMafia({ counts: defaultCounts(5), revealOut: true }, () => 0.99));
    await screen.findByTestId('maf.player');
    return { server, game: () => game };
  }

  it('AC3: covered card, held → role, team and the three lines; secure screen; "I\'m ready" sent once', async () => {
    const { game } = await playMafia();
    expect(screen.getByText('MAFIA · 5 PLAYERS')).toBeOnTheScreen();
    expect(screen.getByText('Seat 1 · guest_1')).toBeOnTheScreen();
    expect(screen.getByText('Your role is ready')).toBeOnTheScreen();
    expect(screen.queryByText('Mafia Boss')).not.toBeOnTheScreen();
    expect(secure.setSecure).toHaveBeenLastCalledWith(true);

    const card = screen.getByTestId('camp.secret.card');
    await fireEvent(card, 'pressIn');
    expect(screen.getByText('YOU ARE THE')).toBeOnTheScreen();
    expect(screen.getByText('Mafia Boss')).toBeOnTheScreen();
    expect(screen.getByText('TEAM MAFIA')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'At night wake with the mafia, choose the victim, then ask the narrator if one player is the Detective.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('By day blend in and steer the vote away from your team.')).toBeOnTheScreen();
    expect(screen.getByText('You win when the mafia equals or outnumbers everyone else.')).toBeOnTheScreen();
    await fireEvent(card, 'pressOut');
    expect(screen.queryByText('Mafia Boss')).not.toBeOnTheScreen();

    expect(screen.getByTestId('maf.ready')).toHaveTextContent("I'm ready · 0 / 5");
    await press('maf.ready');
    await press('maf.ready');
    expect(screen.getByTestId('maf.ready')).toHaveTextContent('Ready · 1 / 5');
    expect(screen.getByTestId('maf.ready')).toBeDisabled();
    const host = game();
    expect(host?.game === 'mafia' ? host.ready : null).toEqual(['p1']);
    expect(qaEvents().filter(entry => entry.event === 'maf_ready')).toHaveLength(1);
  });

  it('AC5: phase + alive line, Out list with fate and role; own seat out → banner and one heavy haptic, gone on Back', async () => {
    const { server } = await playMafia();
    expect(screen.getByText('Night 1')).toBeOnTheScreen();
    expect(screen.getByText('5 / 5 alive')).toBeOnTheScreen();
    expect(screen.queryByText('Out')).not.toBeOnTheScreen();

    await act(() => server.mafMarkOut('p2'));
    expect(screen.getByText('4 / 5 alive')).toBeOnTheScreen();
    const outRow = within(screen.getByTestId('maf.out.p2'));
    expect(outRow.getByText('guest_2')).toBeOnTheScreen();
    expect(outRow.getByText('killed · Night 1')).toBeOnTheScreen();
    expect(outRow.getByText('Detective')).toBeOnTheScreen();
    expect(screen.queryByTestId('maf.out-banner')).not.toBeOnTheScreen();

    haptic.mockClear();
    await act(() => server.mafPhaseNext());
    expect(screen.getByText('Day 1')).toBeOnTheScreen();
    await act(() => server.mafMarkOut('p1'));
    expect(screen.getByTestId('maf.out-banner')).toHaveTextContent(
      "You're out — exiled · Day 1. Stay quiet, no hints!",
    );
    await act(() => server.mafPhaseNext());
    expect(haptic.mock.calls.filter(call => call[0] === 'impactHeavy')).toHaveLength(1);
    expect(screen.getByTestId('maf.card')).toBeOnTheScreen();

    await act(() => server.mafMarkBack('p1'));
    expect(screen.queryByTestId('maf.out-banner')).not.toBeOnTheScreen();
  });

  it('MAF-1/2: a seat removed at night keeps its name/avatar and reads "left · Night 1" on Out and game over', async () => {
    const { server } = await playMafia();
    await act(() => server.remove('p2'));

    const outRow = within(screen.getByTestId('maf.out.p2'));
    expect(outRow.getByText('guest_2')).toBeOnTheScreen();
    expect(outRow.getByText('left · Night 1')).toBeOnTheScreen();
    expect(outRow.getByText('Detective')).toBeOnTheScreen();

    await act(() => server.mafEnd('none'));
    expect(screen.getByTestId('maf.over')).toBeOnTheScreen();
    const overRow = within(screen.getByTestId('maf.over.p2'));
    expect(overRow.getByText('guest_2')).toBeOnTheScreen();
    expect(overRow.getByText('left · Night 1')).toBeOnTheScreen();
  });
});
