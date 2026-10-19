import {
  MAX_SEATS,
  type Hello,
  type RejectReason,
  type RosterPlayer,
  type SeatStatus,
} from '../protocol/codec';
import type { Animal } from '../playerProfile';

/** The host's seat id; players get `p1`, `p2`, … in join order. */
export const HOST_SEAT_ID = 'host';

export type Seat = {
  seatId: string;
  /** Secret a player keeps to take the same seat back after a disconnect. Empty for the host. */
  seatToken: string;
  nickname: string;
  avatar: Animal;
  host: boolean;
  status: SeatStatus;
  /** The live connection on this seat; null for the host and while reconnecting. */
  connId: string | null;
};

export type RoomState = {
  code: string;
  seats: Seat[];
  /** Next player seat number (never reused, so a removed seat id is not handed out again). */
  nextSeat: number;
  closed: boolean;
};

export type RoomAction =
  /** `seatToken` is a fresh random token, used only when the hello takes a new seat. */
  | { type: 'hello'; connId: string; hello: Hello; seatToken: string }
  | { type: 'disconnect'; connId: string }
  | { type: 'leave'; connId: string }
  | { type: 'remove'; seatId: string }
  | { type: 'close' };

export type RoomOutcome =
  | {
      kind: 'welcome';
      connId: string;
      seatId: string;
      seatToken: string;
      rejoin: boolean;
      replacedConnId: string | null;
    }
  | { kind: 'rejected'; connId: string; reason: RejectReason }
  /** A seat was freed; `connId` is its live connection to tell and close, if any. */
  | { kind: 'freed'; connId: string | null }
  | { kind: 'none' };

export type RoomResult = { state: RoomState; outcome: RoomOutcome };

export function createRoom(
  code: string,
  host: { nickname: string; avatar: Animal },
): RoomState {
  return {
    code,
    seats: [
      {
        seatId: HOST_SEAT_ID,
        seatToken: '',
        nickname: host.nickname,
        avatar: host.avatar,
        host: true,
        status: 'connected',
        connId: null,
      },
    ],
    nextSeat: 1,
    closed: false,
  };
}

/** A restored room: same code and seats, every player seat waits for its owner to reconnect. */
export function resumeRoom(saved: RoomState): RoomState {
  return {
    ...saved,
    closed: false,
    seats: saved.seats.map(seat =>
      seat.host
        ? { ...seat, connId: null }
        : { ...seat, status: 'reconnecting', connId: null },
    ),
  };
}

/** `Ann` → `Ann 2` → `Ann 3` while the name is taken (case-insensitive). */
function uniqueName(seats: Seat[], wanted: string): string {
  const taken = new Set(seats.map(seat => seat.nickname.toLocaleLowerCase()));
  if (!taken.has(wanted.toLocaleLowerCase())) {
    return wanted;
  }
  let suffix = 2;
  while (taken.has(`${wanted} ${suffix}`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${wanted} ${suffix}`;
}

const none = (state: RoomState): RoomResult => ({
  state,
  outcome: { kind: 'none' },
});

function hello(
  state: RoomState,
  action: Extract<RoomAction, { type: 'hello' }>,
): RoomResult {
  const { connId } = action;
  if (action.hello.code !== state.code) {
    return {
      state,
      outcome: { kind: 'rejected', connId, reason: 'wrong_code' },
    };
  }
  const token = action.hello.seatToken;
  const own = token
    ? state.seats.find(seat => !seat.host && seat.seatToken === token)
    : undefined;
  if (own) {
    return {
      state: {
        ...state,
        seats: state.seats.map(seat =>
          seat.seatId === own.seatId
            ? { ...seat, status: 'connected', connId }
            : seat,
        ),
      },
      outcome: {
        kind: 'welcome',
        connId,
        seatId: own.seatId,
        seatToken: own.seatToken,
        rejoin: true,
        replacedConnId: own.connId !== connId ? own.connId : null,
      },
    };
  }
  if (state.seats.length >= MAX_SEATS) {
    return { state, outcome: { kind: 'rejected', connId, reason: 'full' } };
  }
  const seat: Seat = {
    seatId: `p${state.nextSeat}`,
    seatToken: action.seatToken,
    nickname: uniqueName(state.seats, action.hello.nickname),
    avatar: action.hello.avatar,
    host: false,
    status: 'connected',
    connId,
  };
  return {
    state: {
      ...state,
      seats: [...state.seats, seat],
      nextSeat: state.nextSeat + 1,
    },
    outcome: {
      kind: 'welcome',
      connId,
      seatId: seat.seatId,
      seatToken: seat.seatToken,
      rejoin: false,
      replacedConnId: null,
    },
  };
}

function free(state: RoomState, match: (seat: Seat) => boolean): RoomResult {
  const seat = state.seats.find(
    candidate => !candidate.host && match(candidate),
  );
  if (!seat) {
    return none(state);
  }
  return {
    state: {
      ...state,
      seats: state.seats.filter(candidate => candidate !== seat),
    },
    outcome: { kind: 'freed', connId: seat.connId },
  };
}

/** The room engine. Pure: the socket layer feeds it events and carries out the outcome. */
export function roomReducer(state: RoomState, action: RoomAction): RoomResult {
  if (state.closed) {
    return none(state);
  }
  switch (action.type) {
    case 'hello':
      return hello(state, action);
    case 'disconnect': {
      if (!state.seats.some(seat => seat.connId === action.connId)) {
        return none(state);
      }
      return none({
        ...state,
        seats: state.seats.map(seat =>
          seat.connId === action.connId
            ? { ...seat, status: 'reconnecting', connId: null }
            : seat,
        ),
      });
    }
    case 'leave':
      return free(state, seat => seat.connId === action.connId);
    case 'remove':
      return free(state, seat => seat.seatId === action.seatId);
    case 'close':
      return none({ ...state, closed: true });
  }
}

export function toRoster(state: RoomState): RosterPlayer[] {
  return state.seats.map(({ seatId, nickname, avatar, host, status }) => ({
    seatId,
    nickname,
    avatar,
    host,
    status,
  }));
}

export function reconnectingCount(state: RoomState): number {
  return state.seats.filter(seat => seat.status === 'reconnecting').length;
}
