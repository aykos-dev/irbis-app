import TcpSocket from 'react-native-tcp-socket';

import type { Animal } from '../playerProfile';
import {
  createLineBuffer,
  decodeHost,
  encode,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
  type GamePhase,
  type MafiaPhase,
  type MafiaPublic,
  type MafiaSecret,
  type OutgoingClientMessage,
  type PublicGame,
  type RejectReason,
  type RosterPlayer,
  type Secret,
  type WyrPick,
} from '../protocol/codec';
import type { PartyGame } from '../games/packs';
import { connectOptions } from './discovery';
import { clearSeatToken, readSeatToken, saveSeatToken } from './seatStore';

/** A dropped player tries again this often (and at once when the app comes back). */
export const RETRY_INTERVAL_MS = 2000;

/** Why the session ended: host's word, our own leave, or the first connect never got through. */
export type PlayerEnd = 'removed' | 'closed' | 'left' | 'unreachable' | RejectReason;

/** The round as every phone sees it (`game` message). */
export type PlayerGame =
  | { game: PartyGame; round: number; phase: GamePhase; public: PublicGame }
  | { game: 'mafia'; round: number; phase: MafiaPhase; public: MafiaPublic };

/** This seat's secret for one round (`deal` message); Mafia: our role. */
export type PlayerDeal =
  | { game: PartyGame; round: number; secret: Secret }
  | { game: 'mafia'; round: number; secret: MafiaSecret };

export type PlayerSnapshot = {
  status: 'connecting' | 'connected' | 'reconnecting' | 'ended';
  seatId: string | null;
  players: RosterPlayer[];
  ended: PlayerEnd | null;
  /** The running game; null in the lobby. */
  game: PlayerGame | null;
  /** Our deal for `game.round`; null when we wait for the next round (or in Would you rather). */
  deal: PlayerDeal | null;
};

export type PlayerClient = {
  readonly code: string;
  /** First connect: hello with the stored seat token for this code, if any. */
  start: () => void;
  /** Foreground or background: retries run only while active; becoming active retries at once. */
  setActive: (active: boolean) => void;
  /** `leave` to the host, seat token forgotten, session over. */
  leave: () => void;
  /** Closes the socket and stops retrying, without a word to the host. */
  stop: () => void;
  /** Would you rather: our pick for the current question. */
  vote: (pick: WyrPick) => void;
  /** Who am I: asks the host for our own character. */
  showMine: () => void;
  /** Mafia: we have seen our role. */
  mafReady: () => void;
  getSnapshot: () => PlayerSnapshot;
  subscribe: (listener: () => void) => () => void;
};

type Options = {
  code: string;
  host: string;
  port: number;
  nickname: string;
  avatar: Animal;
  now?: () => number;
};

type TcpConnection = ReturnType<typeof TcpSocket.createConnection>;

/**
 * The player's side of the local protocol (AC5–AC7): hello, ping every 3 s, live roster, and
 * reconnect every 2 s with the seat token after a drop, so the host gives the same seat back.
 */
export function createPlayerClient({
  code,
  host,
  port,
  nickname,
  avatar,
  now = Date.now,
}: Options): PlayerClient {
  let snapshot: PlayerSnapshot = {
    status: 'connecting',
    seatId: null,
    players: [],
    ended: null,
    game: null,
    deal: null,
  };
  const listeners = new Set<() => void>();
  let socket: TcpConnection | null = null;
  let connected = false;
  let lastSeen = now();
  let active = true;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attemptTimer: ReturnType<typeof setTimeout> | null = null;

  const update = (next: Partial<PlayerSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach(listener => listener());
  };

  const send = (message: OutgoingClientMessage) => {
    if (socket && connected) {
      socket.write(encode(message));
    }
  };

  const clearTimers = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (attemptTimer) {
      clearTimeout(attemptTimer);
      attemptTimer = null;
    }
  };

  const hangUp = () => {
    const current = socket;
    socket = null;
    connected = false;
    if (attemptTimer) {
      clearTimeout(attemptTimer);
      attemptTimer = null;
    }
    current?.destroy();
  };

  const end = (reason: PlayerEnd) => {
    if (snapshot.ended) {
      return;
    }
    if (reason === 'removed' || reason === 'closed' || reason === 'left') {
      clearSeatToken(code);
    }
    clearTimers();
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    hangUp();
    update({ status: 'ended', ended: reason });
  };

  const scheduleRetry = () => {
    if (snapshot.ended || retryTimer || !active) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, RETRY_INTERVAL_MS);
  };

  /** The socket is gone: before any seat that ends the attempt, after one it is a reconnect. */
  const dropped = (gone: TcpConnection) => {
    if (gone !== socket || snapshot.ended) {
      return;
    }
    hangUp();
    if (!snapshot.seatId) {
      end('unreachable');
      return;
    }
    update({ status: 'reconnecting' });
    scheduleRetry();
  };

  const onLine = (line: string) => {
    const decoded = decodeHost(line);
    if (!decoded.ok) {
      if (decoded.reason === 'version') {
        end('version');
      }
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'welcome':
        saveSeatToken(code, message.seatToken);
        update({ status: 'connected', seatId: message.seatId });
        return;
      case 'roster':
        update({ players: message.players });
        return;
      case 'rejected':
        end(message.reason);
        return;
      case 'removed':
      case 'closed':
        end(message.type);
        return;
      case 'deal':
        update({
          deal:
            message.game === 'mafia'
              ? { game: 'mafia', round: message.round, secret: message.secret }
              : { game: message.game, round: message.round, secret: message.secret },
        });
        return;
      case 'game': {
        const { deal } = snapshot;
        update({
          game:
            message.game === 'mafia'
              ? {
                  game: 'mafia',
                  round: message.round,
                  phase: message.phase,
                  public: message.public,
                }
              : {
                  game: message.game,
                  round: message.round,
                  phase: message.phase,
                  public: message.public,
                },
          deal:
            deal && deal.game === message.game && deal.round === message.round
              ? deal
              : null,
        });
        return;
      }
      case 'lobby':
        update({ game: null, deal: null });
        return;
      case 'pong':
      case 'probeOk':
        return;
    }
  };

  function connect() {
    if (snapshot.ended || socket) {
      return;
    }
    const split = createLineBuffer();
    lastSeen = now();
    const opened = TcpSocket.createConnection(connectOptions(host, port), () => {
      if (opened !== socket) {
        return;
      }
      connected = true;
      if (attemptTimer) {
        clearTimeout(attemptTimer);
        attemptTimer = null;
      }
      const seatToken = readSeatToken(code);
      send({
        type: 'hello',
        code,
        nickname,
        avatar,
        ...(seatToken ? { seatToken } : {}),
      });
    });
    socket = opened;
    attemptTimer = setTimeout(() => dropped(opened), RETRY_INTERVAL_MS);
    opened.on('data', data => {
      if (opened !== socket) {
        return;
      }
      lastSeen = now();
      for (const line of split(data.toString())) {
        onLine(line);
      }
    });
    opened.on('error', () => dropped(opened));
    opened.on('close', () => dropped(opened));
  }

  const tick = () => {
    if (!socket || !connected) {
      return;
    }
    if (now() - lastSeen > SILENCE_TIMEOUT_MS) {
      dropped(socket);
      return;
    }
    send({ type: 'ping' });
  };

  return {
    code,
    start: () => {
      if (ticker || snapshot.ended) {
        return;
      }
      ticker = setInterval(tick, PING_INTERVAL_MS);
      connect();
    },
    setActive: next => {
      active = next;
      if (!next) {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        return;
      }
      if (snapshot.status === 'reconnecting' && !socket) {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        connect();
      }
    },
    leave: () => {
      send({ type: 'leave' });
      end('left');
    },
    vote: pick => {
      const { game } = snapshot;
      if (game?.game === 'rather') {
        send({
          type: 'wyrVote',
          round: game.round,
          qIndex: game.public.qIndex ?? 0,
          pick,
        });
      }
    },
    showMine: () => {
      const { game } = snapshot;
      if (game?.game === 'whoami') {
        send({ type: 'showMine', round: game.round });
      }
    },
    mafReady: () => {
      const { game } = snapshot;
      if (game?.game === 'mafia') {
        send({ type: 'mafReady', round: game.round });
      }
    },
    stop: () => {
      clearTimers();
      if (ticker) {
        clearInterval(ticker);
        ticker = null;
      }
      hangUp();
    },
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let activeClient: PlayerClient | null = null;

/** The seated player's session, handed from the join screen to the player lobby. */
export const playerSession = {
  get: (): PlayerClient | null => activeClient,
  set: (client: PlayerClient | null): void => {
    if (activeClient && activeClient !== client) {
      activeClient.stop();
    }
    activeClient = client;
  },
};
