import { fakeNet } from '../../../../jest/campNetFakes';
import {
  discoverRoom,
  findRoomAt,
  probeHost,
  type DiscoveryResult,
} from '../../../features/campfire-core/join/discovery';
import { CONNECT_TIMEOUT_MS, createPlayerClient } from '../../../features/campfire-core/join/playerClient';
import { readSeatToken, saveSeatToken } from '../../../features/campfire-core/join/seatStore';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { createHostServer, type HostServer } from '../../../features/campfire-core/room/hostServer';
import {
  createRoom,
  roomReducer,
  type RoomState,
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

const HOST_IP = '192.168.49.1';
let log: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  fakeNet.reset();
  storage.clearAll();
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.mocked(campNet.getWifiIp).mockReset().mockResolvedValue('192.168.49.23');
});
afterEach(() => {
  jest.useRealTimers();
  log.mockRestore();
});

/** A room with guest_1 on seat p1 (token `seat_token_1`), served at `ip`. */
async function hostRoom(ip = HOST_IP, withSeat = false): Promise<{ server: HostServer; room: () => RoomState }> {
  let room = createRoom('4821', { nickname: 'guest_0', avatar: 'fox' });
  if (withSeat) {
    room = roomReducer(room, {
      type: 'hello',
      connId: 'old',
      hello: { v: 4, type: 'hello', code: '4821', nickname: 'guest_1', avatar: 'bear' },
      seatToken: 'seat_token_1',
    }).state;
    room = roomReducer(room, { type: 'disconnect', connId: 'old' }).state;
  }
  let current = room;
  const server = createHostServer({ room, network: 'DIRECT-irbis', onChange: next => (current = next) });
  await server.start();
  fakeNet.serve(ip, fakeNet.server());
  return { server, room: () => current };
}

function track(promise: Promise<DiscoveryResult>) {
  const box: { result: DiscoveryResult | null } = { result: null };
  promise.then(result => (box.result = result));
  return box;
}

function joinedEvents() {
  return log.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.includes('camp_player_joined'))
    .map(line => JSON.parse(line.slice(line.indexOf('{'))));
}

describe('campfire-core — discovery by code (AC5)', () => {
  it('AC5: a Bonjour hit is probed directly, no subnet scan', async () => {
    await hostRoom('10.0.0.9');
    fakeNet.services = [
      { name: 'irbis-4821', type: 'irbiscamp', port: 47821, ipv4: ['10.0.0.9'], addresses: ['10.0.0.9'], txt: { code: '4821' } },
    ];
    const found = track(discoverRoom('4821', new AbortController().signal));
    await jest.advanceTimersByTimeAsync(10);

    expect(found.result).toEqual({
      kind: 'found',
      room: { code: '4821', host: '10.0.0.9', port: 47821, players: 1, network: 'DIRECT-irbis' },
    });
    expect(fakeNet.scans).toEqual(['irbiscamp']);
    expect(fakeNet.dials).toEqual([{ host: '10.0.0.9', port: 47821 }]);
  });

  it('AC5: no Bonjour answer in 3 s → scans the /24 on :47821 (skipping itself) and finds the host', async () => {
    await hostRoom();
    const found = track(discoverRoom('4821', new AbortController().signal));
    await jest.advanceTimersByTimeAsync(2999);
    expect(fakeNet.dials).toHaveLength(0);

    await jest.advanceTimersByTimeAsync(10);
    expect(found.result).toMatchObject({ kind: 'found', room: { host: HOST_IP, players: 1 } });
    expect(fakeNet.dials.every(dial => dial.port === 47821 && dial.host.startsWith('192.168.49.'))).toBe(true);
    expect(fakeNet.dials.some(dial => dial.host === '192.168.49.23')).toBe(false);
  });

  it('AC5: nobody answers → not_found within 8 s; a QR host that never answers gives up at 8 s', async () => {
    fakeNet.silent = true;
    const byCode = track(discoverRoom('4821', new AbortController().signal));
    await jest.advanceTimersByTimeAsync(8000);
    expect(byCode.result).toEqual({ kind: 'not_found' });
    expect(fakeNet.dials).toHaveLength(253);

    const byQr = track(findRoomAt('10.0.0.9', 47821, '4821', new AbortController().signal));
    await jest.advanceTimersByTimeAsync(7500);
    expect(byQr.result).toBeNull();
    await jest.advanceTimersByTimeAsync(500);
    expect(byQr.result).toEqual({ kind: 'not_found' });
  });
});

describe('campfire-core — player client (AC7, player)', () => {
  it('AC7: hello carries the stored seat token (same seat); a drop retries every 2 s and takes the seat back', async () => {
    const host = await hostRoom(HOST_IP, true);
    saveSeatToken('4821', 'seat_token_1');
    const client = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    client.start();
    await jest.advanceTimersByTimeAsync(0);

    expect(client.getSnapshot()).toMatchObject({ status: 'connected', seatId: 'p1' });
    expect(client.getSnapshot().players.map(player => player.seatId)).toEqual(['host', 'p1']);
    expect(joinedEvents()).toEqual([{ event: 'camp_player_joined', seats: 2, rejoin: true }]);

    fakeNet.cut(HOST_IP);
    expect(client.getSnapshot().status).toBe('reconnecting');
    await jest.advanceTimersByTimeAsync(2000);
    expect(client.getSnapshot().status).toBe('reconnecting');

    fakeNet.serve(HOST_IP, fakeNet.server());
    await jest.advanceTimersByTimeAsync(2000);
    expect(client.getSnapshot()).toMatchObject({ status: 'connected', seatId: 'p1' });
    expect(host.room().seats).toHaveLength(2);
    expect(joinedEvents().at(-1)).toEqual({ event: 'camp_player_joined', seats: 2, rejoin: true });

    // In the background no retries; back in the foreground it retries at once.
    client.setActive(false);
    fakeNet.cut(HOST_IP);
    fakeNet.serve(HOST_IP, fakeNet.server());
    const dials = fakeNet.dials.length;
    await jest.advanceTimersByTimeAsync(6000);
    expect(fakeNet.dials).toHaveLength(dials);
    client.setActive(true);
    await jest.advanceTimersByTimeAsync(0);
    expect(client.getSnapshot()).toMatchObject({ status: 'connected', seatId: 'p1' });
    client.stop();
  });

  it('AC7: removed or closed by the host → session ends and the seat token is deleted', async () => {
    const host = await hostRoom();
    const first = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    first.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(readSeatToken('4821')).toEqual(expect.any(String));

    host.server.remove('p1');
    expect(first.getSnapshot()).toMatchObject({ status: 'ended', ended: 'removed' });
    expect(readSeatToken('4821')).toBeUndefined();

    const second = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_2', avatar: 'ibex' });
    second.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(second.getSnapshot().seatId).toBe('p2');
    host.server.close();
    expect(second.getSnapshot()).toMatchObject({ status: 'ended', ended: 'closed' });
    expect(readSeatToken('4821')).toBeUndefined();
  });
});

describe('campfire-core — join sockets (CORE-1, CORE-2, CORE-3)', () => {
  it('CORE-1: a join behind the scan queue waits for it instead of ending "unreachable" after 2 s', async () => {
    await hostRoom();
    fakeNet.connectDelayMs = 3000;
    const client = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    client.start();

    await jest.advanceTimersByTimeAsync(2500);
    expect(client.getSnapshot()).toMatchObject({ status: 'connecting', ended: null });

    await jest.advanceTimersByTimeAsync(600);
    expect(client.getSnapshot()).toMatchObject({ status: 'connected', seatId: 'p1' });
    client.stop();
  });

  it('CORE-2: a timed-out dial is not destroyed before its native connect settles', async () => {
    fakeNet.silent = true;
    fakeNet.connectDelayMs = 20000;
    const client = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    client.start();

    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS + 1000);
    expect(client.getSnapshot()).toMatchObject({ status: 'ended', ended: 'unreachable' });
    expect(fakeNet.earlyDestroys).toBe(0);
    client.stop();
  });

  it('CORE-2: a probe that times out before connecting never destroys a queued id', async () => {
    fakeNet.connectDelayMs = 100;
    let result: Awaited<ReturnType<typeof probeHost>> | null = null;
    void probeHost('10.0.0.99', 47821, '4821', 10).then(value => (result = value));

    await jest.advanceTimersByTimeAsync(10);
    expect(result).toEqual({ kind: 'miss' });
    await jest.advanceTimersByTimeAsync(100);
    expect(fakeNet.earlyDestroys).toBe(0);
  });

  it('CORE-3: a retry with the token of a freed seat gets "removed", never a new seat', async () => {
    const host = await hostRoom(HOST_IP, true);
    saveSeatToken('4821', 'seat_token_1');
    const first = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    first.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(first.getSnapshot().seatId).toBe('p1');
    first.stop();

    // The first `removed` was lost (the seat is already reconnecting): the retry must still be refused.
    host.server.remove('p1');
    const retry = createPlayerClient({ code: '4821', host: HOST_IP, port: 47821, nickname: 'guest_1', avatar: 'bear' });
    retry.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(retry.getSnapshot()).toMatchObject({ status: 'ended', ended: 'removed' });
    expect(host.room().seats.map(seat => seat.seatId)).toEqual(['host']);
    expect(readSeatToken('4821')).toBeUndefined();
  });
});
