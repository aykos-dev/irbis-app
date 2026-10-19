import {
  decodeClient,
  decodeHost,
  encode,
  type Hello,
} from '../../../features/campfire-core/protocol/codec';
import {
  buildJoinUrl,
  parseJoinUrl,
} from '../../../features/campfire-core/protocol/qr';
import {
  clearHostRoom,
  loadHostRoom,
  RESUME_WINDOW_MS,
  saveHostRoom,
} from '../../../features/campfire-core/room/hostRoomStore';
import {
  createRoom,
  roomReducer,
  type RoomAction,
  type RoomState,
} from '../../../features/campfire-core/room/roomReducer';

const hello = (nickname: string, seatToken?: string, code = '4821'): Hello => ({
  v: 1,
  type: 'hello',
  code,
  nickname,
  avatar: 'bear',
  ...(seatToken ? { seatToken } : {}),
});

function run(state: RoomState, ...actions: RoomAction[]): RoomState {
  return actions.reduce(
    (current, action) => roomReducer(current, action).state,
    state,
  );
}

const join = (n: number): Extract<RoomAction, { type: 'hello' }> => ({
  type: 'hello',
  connId: `c${n}`,
  hello: hello(`guest_${n}`),
  seatToken: `token_${n}`,
});

const room = () => createRoom('4821', { nickname: 'guest_0', avatar: 'fox' });

describe('campfire-core — room reducer (AC6, AC7)', () => {
  it('AC6: seats up to 15 including the host, the 16th is rejected full; wrong code is rejected', () => {
    const full = run(
      room(),
      ...Array.from({ length: 14 }, (_, i) => join(i + 1)),
    );
    expect(full.seats).toHaveLength(15);
    expect(full.seats[0]).toMatchObject({ seatId: 'host', host: true });

    const sixteenth = roomReducer(full, join(16));
    expect(sixteenth.outcome).toEqual({
      kind: 'rejected',
      connId: 'c16',
      reason: 'full',
    });
    expect(sixteenth.state).toBe(full);

    const wrong = roomReducer(room(), {
      ...join(1),
      hello: hello('guest_1', undefined, '1111'),
    });
    expect(wrong.outcome).toMatchObject({
      kind: 'rejected',
      reason: 'wrong_code',
    });
  });

  it('AC6: a taken name gets " 2", " 3"; remove frees the seat and returns its connection', () => {
    const named = (
      connId: string,
      nickname: string,
      seatToken: string,
    ): RoomAction => ({
      type: 'hello',
      connId,
      hello: hello(nickname),
      seatToken,
    });
    const state = run(
      room(),
      named('c1', 'Ann', 't1'),
      named('c2', 'ann', 't2'),
      named('c3', 'Ann', 't3'),
    );
    expect(state.seats.map(seat => seat.nickname)).toEqual([
      'guest_0',
      'Ann',
      'ann 2',
      'Ann 3',
    ]);

    const removed = roomReducer(state, { type: 'remove', seatId: 'p2' });
    expect(removed.outcome).toEqual({ kind: 'freed', connId: 'c2' });
    expect(removed.state.seats.map(seat => seat.seatId)).toEqual([
      'host',
      'p1',
      'p3',
    ]);
    expect(
      roomReducer(state, { type: 'remove', seatId: 'host' }).outcome,
    ).toEqual({ kind: 'none' });
  });

  it('AC7: disconnect keeps the seat as reconnecting; the seat token takes it back with the same seatId; close ends the room', () => {
    const joined = run(room(), join(1));
    const lost = run(joined, { type: 'disconnect', connId: 'c1' });
    expect(lost.seats[1]).toMatchObject({
      seatId: 'p1',
      status: 'reconnecting',
      connId: null,
    });

    const back = roomReducer(lost, {
      type: 'hello',
      connId: 'c9',
      hello: hello('guest_1', 'token_1'),
      seatToken: 'fresh',
    });
    expect(back.outcome).toMatchObject({
      kind: 'welcome',
      seatId: 'p1',
      seatToken: 'token_1',
      rejoin: true,
    });
    expect(back.state.seats).toHaveLength(2);
    expect(back.state.seats[1]).toMatchObject({
      status: 'connected',
      connId: 'c9',
    });

    const closed = run(back.state, { type: 'close' });
    expect(closed.closed).toBe(true);
    expect(roomReducer(closed, join(2)).state).toBe(closed);
  });
});

describe('campfire-core — protocol', () => {
  it('AC6: codec rejects bad JSON and wrong versions; encodes NDJSON with v 1', () => {
    expect(encode({ type: 'pong' })).toBe('{"v":1,"type":"pong"}\n');
    expect(decodeClient('{not json')).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeClient('{"v":2,"type":"ping"}')).toEqual({
      ok: false,
      reason: 'version',
    });
    expect(
      decodeClient(
        '{"v":1,"type":"hello","code":"48","nickname":"a","avatar":"fox"}',
      ),
    ).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(decodeClient(JSON.stringify(hello('guest_1')))).toEqual({
      ok: true,
      message: hello('guest_1'),
    });
    expect(decodeHost('{"v":1,"type":"rejected","reason":"full"}')).toEqual({
      ok: true,
      message: { v: 1, type: 'rejected', reason: 'full' },
    });
  });

  it('AC4: the join QR round-trips, with Wi-Fi fields only for a hotspot', () => {
    const hotspot = {
      code: '4821',
      ip: '192.168.49.1',
      port: 47821,
      wifi: { ssid: 'DIRECT-ab irbis', password: 'p&w=1' },
    };
    const url = buildJoinUrl(hotspot);
    expect(url).toMatch(
      /^irbis-camp:\/\/join\?v=1&code=4821&ip=192\.168\.49\.1&port=47821&ssid=/,
    );
    expect(parseJoinUrl(url)).toEqual(hotspot);

    const wifi = { code: '1000', ip: '10.0.0.5', port: 47821 };
    expect(buildJoinUrl(wifi)).toBe(
      'irbis-camp://join?v=1&code=1000&ip=10.0.0.5&port=47821',
    );
    expect(parseJoinUrl(buildJoinUrl(wifi))).toEqual(wifi);
    expect(
      parseJoinUrl('irbis-camp://join?v=2&code=1000&ip=10.0.0.5&port=47821'),
    ).toBeNull();
    expect(parseJoinUrl('https://example.com')).toBeNull();
  });
});

describe('campfire-core — saved host room (AC7)', () => {
  afterEach(clearHostRoom);

  it('AC7: loads a room saved less than 12 h ago without live connections; drops an older one', () => {
    const saved = run(room(), join(1));
    saveHostRoom(saved, 1_000);
    const loaded = loadHostRoom(1_000 + RESUME_WINDOW_MS - 1);
    expect(loaded?.code).toBe('4821');
    expect(loaded?.nextSeat).toBe(2);
    expect(
      loaded?.seats.map(seat => [seat.seatId, seat.seatToken, seat.connId]),
    ).toEqual([
      ['host', '', null],
      ['p1', 'token_1', null],
    ]);

    expect(loadHostRoom(1_000 + RESUME_WINDOW_MS)).toBeNull();
    expect(loadHostRoom(1_000)).toBeNull();
  });
});
