import { act, fireEvent, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { fakeCamera, fakeNet, fakeWifi } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { buildJoinUrl } from '../../../features/campfire-core/protocol/qr';
import { createHostServer, type HostServer } from '../../../features/campfire-core/room/hostServer';
import { createRoom, roomReducer, type RoomState } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type,
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

const HOST_IP = '192.168.49.1';
const wifi = { ssid: 'DIRECT-irbis', password: 'pw_1' };
const qr = buildJoinUrl({ code: '4821', ip: HOST_IP, port: 47821, wifi });

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  jest.useFakeTimers();
  fakeNet.reset();
  fakeCamera.reset();
  fakeWifi.reset();
  jest.mocked(campNet.getWifiIp).mockReset().mockResolvedValue('192.168.49.23');
  jest.mocked(campNet.getWifiName).mockReset().mockResolvedValue(null);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_1', animal: 'bear' }));
});
afterEach(async () => {
  jest.useRealTimers();
  await tearDownApp(http);
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Room 4821 on the host at 192.168.49.1; `seats` extra players fill it up. */
async function hostRoom(seats = 0, tokenSeat = false): Promise<{ server: HostServer; room: () => RoomState }> {
  let room = createRoom('4821', { nickname: 'guest_0', avatar: 'fox' });
  for (let index = 0; index < seats; index += 1) {
    room = roomReducer(room, {
      type: 'hello',
      connId: `c${index}`,
      hello: { v: 1, type: 'hello', code: '4821', nickname: 'guest_x', avatar: 'ibex' },
      seatToken: index === 0 && tokenSeat ? 'seat_token_1' : `token_${index}`,
    }).state;
    room = roomReducer(room, { type: 'disconnect', connId: `c${index}` }).state;
  }
  let current = room;
  const server = createHostServer({ room, network: wifi.ssid, onChange: next => (current = next) });
  await server.start();
  fakeNet.serve(HOST_IP, fakeNet.server());
  return { server, room: () => current };
}

async function openJoin() {
  await renderApp();
  await openTab('community');
  await act(() => {
    navigationRef.navigate('CampJoin');
  });
  await screen.findByTestId('camp.join.screen');
}

async function scan(value: string) {
  await act(async () => {
    fakeCamera.scan(value);
    await jest.advanceTimersByTimeAsync(10);
  });
}

async function joinRoom() {
  await fireEvent.press(await screen.findByTestId('camp.join.submit'));
  await advance(10);
  await screen.findByTestId('camp.lobby.wait');
}

describe('campfire-core — join by QR or code (AC5)', () => {
  it('AC5: QR with Wi-Fi → joins the hotspot, then the room; "Join as" seats the player', async () => {
    const host = await hostRoom();
    await openJoin();
    expect(screen.getByText("Point at the QR code on the host's phone")).toBeOnTheScreen();
    expect(screen.getByTestId('camp.join.hint')).toHaveTextContent(/join the host's hotspot first/);

    await scan(qr);
    expect(fakeWifi.joins).toEqual([{ ssid: wifi.ssid, password: wifi.password, dialsBefore: 0 }]);
    expect(fakeNet.dials[0]).toEqual({ host: HOST_IP, port: 47821 });
    const found = await screen.findByTestId('camp.join.found');
    expect(found).toHaveTextContent('Connected to "DIRECT-irbis"', { exact: false });
    expect(found).toHaveTextContent('Room found · 1 players waiting', { exact: false });
    expect(screen.getByTestId('camp.join.submit')).toHaveTextContent('Join as guest_1', { exact: false });

    await joinRoom();
    expect(navigationRef.getCurrentRoute()).toMatchObject({ name: 'CampLobby', params: { player: true } });
    expect(storage.getString('camp.seats.4821')).toEqual(expect.any(String));
    expect(host.room().seats.map(seat => seat.nickname)).toEqual(['guest_0', 'guest_1']);
  });

  it('AC5: QR Wi-Fi join fails → error, no connect; already on the hotspot → no Wi-Fi join', async () => {
    await hostRoom();
    fakeWifi.fail = true;
    await openJoin();
    await scan(qr);

    expect(await screen.findByTestId('camp.join.error')).toHaveTextContent("Couldn't join the host's Wi-Fi. Join it in Settings.", { exact: false });
    expect(fakeNet.dials).toHaveLength(0);
    expect(qaEvents()).toContainEqual({ event: 'camp_join_failed', reason: 'wifi' });

    jest.mocked(campNet.getWifiName).mockResolvedValue(wifi.ssid);
    await fireEvent.press(screen.getByTestId('camp.join.retry'));
    await advance(10);
    expect(await screen.findByTestId('camp.join.found')).toBeOnTheScreen();
    expect(fakeWifi.joins).toHaveLength(1);
  });

  it('AC5: typed code → searching, Bonjour miss, subnet scan finds the room', async () => {
    await hostRoom();
    await openJoin();
    await type('camp.join.code', '48');
    expect(screen.queryByTestId('camp.join.searching')).not.toBeOnTheScreen();
    await type('camp.join.code', '4821');
    expect(screen.getByTestId('camp.join.searching')).toHaveTextContent('Looking for the room…', { exact: false });

    await advance(3100);
    expect(await screen.findByTestId('camp.join.found')).toHaveTextContent('Room found · 1 players waiting', { exact: false });
  });

  it('AC5: errors — not found after 8 s, full, version — each with Try again', async () => {
    fakeNet.silent = true;
    await openJoin();
    await type('camp.join.code', '4821');
    await advance(8000);
    expect(await screen.findByTestId('camp.join.error')).toHaveTextContent("Room not found. Join the host's Wi-Fi first, then try again.", { exact: false });
    expect(qaEvents()).toContainEqual({ event: 'camp_join_failed', reason: 'not_found' });

    await hostRoom(14);
    await fireEvent.press(screen.getByTestId('camp.join.retry'));
    await advance(3100);
    expect(await screen.findByTestId('camp.join.error')).toHaveTextContent('This room is full (15 / 15)', { exact: false });
    expect(qaEvents()).toContainEqual({ event: 'camp_join_failed', reason: 'full' });

    const old = fakeNet.hosts[HOST_IP];
    expect(old).toBeDefined();
    const future = jest.requireMock<typeof import('react-native-tcp-socket')>('react-native-tcp-socket').default.createServer(
      socket => {
        socket.on('data', () => {
          socket.write(`${JSON.stringify({ v: 2, type: 'probeOk', players: 1, network: 'x' })}\n`);
        });
      },
    );
    future.listen({ port: 47821 });
    fakeNet.serve(HOST_IP, fakeNet.server());
    await fireEvent.press(screen.getByTestId('camp.join.retry'));
    await advance(3100);
    expect(await screen.findByTestId('camp.join.error')).toHaveTextContent('Update Irbis to join this room', { exact: false });
    expect(qaEvents()).toContainEqual({ event: 'camp_join_failed', reason: 'version' });
  });

  it('AC5: camera denied → note and Allow camera (opens Settings); typing the code still works', async () => {
    fakeCamera.status = 'denied';
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await hostRoom();
    await openJoin();

    expect(screen.getByTestId('camp.join.camera-denied')).toHaveTextContent('Camera is off. You can still type the code.', { exact: false });
    expect(screen.queryByTestId('camp.join.camera')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_join_failed', reason: 'camera_denied' });
    await fireEvent.press(screen.getByTestId('camp.join.allow-camera'));
    expect(openSettings).toHaveBeenCalled();

    await type('camp.join.code', '4821');
    await advance(3100);
    expect(await screen.findByTestId('camp.join.found')).toBeOnTheScreen();
    openSettings.mockRestore();
  });
});

describe('campfire-core — player lobby (AC6, AC7 player)', () => {
  it('AC6: player lobby shows the live roster, waits for the host, no host controls; Leave frees the seat → hub', async () => {
    const host = await hostRoom();
    await openJoin();
    await scan(qr);
    await joinRoom();

    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent('Players · 2 / 15', { exact: false });
    expect(screen.getByTestId('camp.lobby.wait')).toHaveTextContent('Waiting for the host to start', { exact: false });
    expect(screen.queryByTestId('camp.lobby.qr')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('camp.lobby.start')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('camp.lobby.game.mafia')).not.toBeOnTheScreen();

    const other = fakeNet.server().connect();
    await act(() => other.send({ v: 1, type: 'hello', code: '4821', nickname: 'guest_2', avatar: 'eagle' }));
    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent('Players · 3 / 15', { exact: false });

    await fireEvent.press(screen.getByTestId('camp.lobby.leave'));
    await advance(10);
    expect(await screen.findByTestId('camp.hub.screen')).toBeOnTheScreen();
    expect(host.room().seats.map(seat => seat.nickname)).toEqual(['guest_0', 'guest_2']);
    expect(storage.getString('camp.seats.4821')).toBeUndefined();
  });

  it('AC7: drop → "Reconnecting…", retried every 2 s, same seat; after an app restart the stored token rejoins', async () => {
    const host = await hostRoom(1, true);
    storage.setString('camp.seats.4821', 'seat_token_1');
    await openJoin();
    await type('camp.join.code', '4821');
    await advance(3100);
    await joinRoom();
    expect(qaEvents()).toContainEqual({ event: 'camp_player_joined', seats: 2, rejoin: true });
    expect(host.room().seats.find(seat => seat.seatId === 'p1')?.status).toBe('connected');

    await act(() => fakeNet.cut(HOST_IP));
    expect(screen.getByTestId('camp.lobby.reconnecting')).toHaveTextContent('Reconnecting to the host…', { exact: false });
    await advance(2000);
    expect(screen.getByTestId('camp.lobby.reconnecting')).toBeOnTheScreen();

    fakeNet.serve(HOST_IP, fakeNet.server());
    await advance(2000);
    expect(screen.queryByTestId('camp.lobby.reconnecting')).not.toBeOnTheScreen();
    expect(host.room().seats).toHaveLength(2);
    expect(host.room().seats.find(seat => seat.seatId === 'p1')?.status).toBe('connected');
  });

  it('AC7: removed → toast and hub, token deleted; closed → toast and hub', async () => {
    const host = await hostRoom();
    await openJoin();
    await scan(qr);
    await joinRoom();
    await act(() => host.server.remove('p1'));
    expect(await screen.findByTestId('app.toast')).toHaveTextContent('The host removed you from the room', { exact: false });
    expect(await screen.findByTestId('camp.hub.screen')).toBeOnTheScreen();
    expect(storage.getString('camp.seats.4821')).toBeUndefined();
    // Let the first toast run out.
    await advance(6000);

    await act(() => {
      navigationRef.navigate('CampJoin');
    });
    await scan(qr);
    await joinRoom();
    await act(() => host.server.close());
    expect(await screen.findByText('The host closed the room')).toBeOnTheScreen();
    expect(await screen.findByTestId('camp.hub.screen')).toBeOnTheScreen();
    expect(storage.getString('camp.seats.4821')).toBeUndefined();
  });
});
