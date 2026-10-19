import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';

import { qaLog } from '../../../shared/utils/qaLog';
import { uuidV4 } from '../../../shared/utils/uuid';
import {
  gameReducer,
  idsNeeded,
  inRange,
  roundSeats,
  toPublic,
  type GameAction,
  type GameSeat,
  type GameSettings,
  type GameState,
} from '../games/gameReducer';
import { findPack, type PartyGame } from '../games/packs';
import { drawIds, type Rng } from '../games/usedStore';
import {
  CAMP_PORT,
  createLineBuffer,
  decodeClient,
  encode,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
  type OutgoingHostMessage,
  type WyrPick,
} from '../protocol/codec';
import {
  roomReducer,
  toRoster,
  type RoomAction,
  type RoomOutcome,
  type RoomState,
} from './roomReducer';

/** Bonjour / NSD service the join screen looks for (TXT `code`). */
export const SERVICE_TYPE = 'irbiscamp';

type TcpServer = ReturnType<typeof TcpSocket.createServer>;
type TcpConnection = InstanceType<typeof TcpSocket.Socket>;

type Conn = {
  id: string;
  socket: TcpConnection;
  lastSeen: number;
  seated: boolean;
};

export type HostServer = {
  /** Listens on :47821 and publishes the room over zeroconf. */
  start: () => Promise<void>;
  /** Host removes a player: `removed`, socket closed, seat freed. */
  remove: (seatId: string) => void;
  /** Host closes the room: `closed` to everyone, then everything stops. */
  close: () => void;
  /** Stops listening and drops every socket (unmount); the room stays as it was. */
  stop: () => void;
  /** Deals round 1 to the connected seats (host included) when their count is in range. */
  startGame: (game: PartyGame, settings: GameSettings, rng?: Rng) => void;
  /** Deals the next round to the seats connected now (mid-round joiners included). */
  newRound: (rng?: Rng) => void;
  /** Ends the game for everyone: `lobby` to all. */
  endGame: () => void;
  /** Imposter: shows every phone who the imposters were and the word. */
  reveal: () => void;
  /** Would you rather: a seat's pick for the current question (the host's own seat included). */
  vote: (seatId: string, pick: WyrPick) => void;
  /** Would you rather: the host reveals before everyone voted. */
  revealVotes: () => void;
  /** Would you rather: the next of the round's questions. */
  nextQuestion: () => void;
  /** Who am I: deals the seat its own character (`mine`), to that seat only. */
  showMine: (seatId: string) => void;
};

type Options = {
  room: RoomState;
  /** Network name players see after a probe ("Connected to …"): hotspot SSID or Wi-Fi name. */
  network?: string;
  /** A running game restored with the room (resume). */
  game?: GameState | null;
  onChange: (room: RoomState, game: GameState | null) => void;
  now?: () => number;
};

/** The socket layer around `roomReducer`: feeds it events and carries out each outcome. */
export function createHostServer({
  room,
  network = '',
  game: restoredGame = null,
  onChange,
  now = Date.now,
}: Options): HostServer {
  let state = room;
  let game = restoredGame;
  let server: TcpServer | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;
  const conns = new Map<string, Conn>();
  const zeroconf = new Zeroconf();
  const serviceName = `irbis-${room.code}`;

  const send = (conn: Conn, message: OutgoingHostMessage) => {
    conn.socket.write(encode(message));
  };

  const hangUp = (conn: Conn) => {
    conns.delete(conn.id);
    conn.socket.destroy();
  };

  const broadcastRoster = () => {
    const players = toRoster(state);
    conns.forEach(conn => {
      if (conn.seated) {
        send(conn, { type: 'roster', players });
      }
    });
  };

  const seatOf = (conn: Conn) =>
    state.seats.find(seat => seat.connId === conn.id)?.seatId ?? null;

  /** Per-seat secret first, then the public round; a seat outside the round gets only the latter. */
  const sendGame = (conn: Conn, withDeal: boolean) => {
    if (!game) {
      return;
    }
    const seatId = seatOf(conn);
    const secret = seatId ? game.deals[seatId] : undefined;
    if (withDeal && secret) {
      send(conn, { type: 'deal', game: game.game, round: game.round, secret });
    }
    send(conn, {
      type: 'game',
      game: game.game,
      round: game.round,
      phase: game.phase,
      public: toPublic(game),
    });
  };

  const broadcastGame = (withDeals: boolean) => {
    conns.forEach(conn => {
      if (conn.seated) {
        sendGame(conn, withDeals);
      }
    });
  };

  const applyGame = (action: GameAction): boolean => {
    const next = gameReducer(game, action);
    if (next === game) {
      return false;
    }
    game = next;
    onChange(state, game);
    return true;
  };

  const gameSeats = (): GameSeat[] =>
    state.seats.map(seat => ({
      seatId: seat.seatId,
      connected: seat.status === 'connected',
    }));

  /** Draws the round's pack items (no-repeat, AC8); null when the pack is unknown. */
  const draw = (kind: PartyGame, packId: string, rng: Rng) => {
    const pack = findPack(packId);
    if (!pack || pack.game !== kind) {
      return null;
    }
    return drawIds(kind, pack, idsNeeded(kind, roundSeats(gameSeats()).length), rng);
  };

  const connOf = (seatId: string) => {
    const connId = state.seats.find(seat => seat.seatId === seatId)?.connId;
    return connId ? conns.get(connId) : undefined;
  };

  /** Would you rather: shows the picks on every phone; `forced` = the host didn't wait for all votes. */
  const revealVotes = (forced: boolean) => {
    if (!game || game.game !== 'rather' || !applyGame({ type: 'wyrReveal' })) {
      return;
    }
    broadcastGame(false);
    qaLog('camp_wyr_revealed', {
      votes: Object.keys(game.votes).length,
      forced,
    });
  };

  /** Auto-reveal once every connected player of the round has voted. */
  const revealIfAllVoted = () => {
    if (!game || game.game !== 'rather' || game.phase !== 'voting') {
      return;
    }
    const votes = game.votes;
    const connected = roundSeats(gameSeats()).filter(seatId =>
      game?.players.includes(seatId),
    );
    if (
      connected.length > 0 &&
      connected.every(seatId => votes[seatId] !== undefined)
    ) {
      revealVotes(false);
    }
  };

  const vote = (seatId: string, round: number, qIndex: number, pick: WyrPick) => {
    if (!applyGame({ type: 'wyrVote', seatId, round, qIndex, pick })) {
      return;
    }
    broadcastGame(false);
    revealIfAllVoted();
  };

  const showMine = (seatId: string, round: number) => {
    if (!game || !applyGame({ type: 'showMine', seatId, round })) {
      return;
    }
    const secret = game?.deals[seatId];
    const conn = connOf(seatId);
    if (game && secret && conn) {
      send(conn, { type: 'deal', game: game.game, round: game.round, secret });
    }
    qaLog('camp_whoami_show_mine', { round });
  };

  const apply = (action: RoomAction): RoomOutcome => {
    const result = roomReducer(state, action);
    if (result.state !== state) {
      state = result.state;
      onChange(state, game);
      if (!state.closed) {
        broadcastRoster();
      }
    }
    return result.outcome;
  };

  const freed = (outcome: RoomOutcome, message: OutgoingHostMessage | null) => {
    if (outcome.kind !== 'freed' || !outcome.connId) {
      return;
    }
    const conn = conns.get(outcome.connId);
    if (conn) {
      if (message) {
        send(conn, message);
      }
      hangUp(conn);
    }
  };

  const drop = (conn: Conn) => {
    if (conns.get(conn.id) !== conn) {
      return;
    }
    conns.delete(conn.id);
    apply({ type: 'disconnect', connId: conn.id });
    revealIfAllVoted();
  };

  const onLine = (conn: Conn, line: string) => {
    const decoded = decodeClient(line);
    if (!decoded.ok) {
      if (decoded.reason === 'version') {
        send(conn, { type: 'rejected', reason: 'version' });
        hangUp(conn);
      }
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'ping':
        send(conn, { type: 'pong' });
        return;
      case 'leave': {
        const seatId = seatOf(conn);
        freed(apply({ type: 'leave', connId: conn.id }), null);
        if (seatId && applyGame({ type: 'seatRemoved', seatId })) {
          broadcastGame(false);
          revealIfAllVoted();
        }
        return;
      }
      case 'wyrVote': {
        const seatId = seatOf(conn);
        if (seatId) {
          vote(seatId, message.round, message.qIndex, message.pick);
        }
        return;
      }
      case 'showMine': {
        const seatId = seatOf(conn);
        if (seatId) {
          showMine(seatId, message.round);
        }
        return;
      }
      // The prober reads the answer and hangs up; an idle prober is dropped by the silence check.
      case 'probe':
        send(
          conn,
          message.code === state.code
            ? { type: 'probeOk', players: state.seats.length, network }
            : { type: 'rejected', reason: 'wrong_code' },
        );
        return;
      case 'hello': {
        const outcome = apply({
          type: 'hello',
          connId: conn.id,
          hello: message,
          seatToken: uuidV4(),
        });
        if (outcome.kind === 'rejected') {
          send(conn, { type: 'rejected', reason: outcome.reason });
          hangUp(conn);
        } else if (outcome.kind === 'welcome') {
          const replaced = outcome.replacedConnId
            ? conns.get(outcome.replacedConnId)
            : undefined;
          if (replaced) {
            hangUp(replaced);
          }
          conn.seated = true;
          send(conn, {
            type: 'welcome',
            seatId: outcome.seatId,
            seatToken: outcome.seatToken,
            room: { code: state.code },
          });
          send(conn, { type: 'roster', players: toRoster(state) });
          if (game) {
            if (applyGame({ type: 'seatJoined', seatId: outcome.seatId })) {
              broadcastGame(false);
            } else {
              sendGame(conn, true);
            }
          }
          qaLog('camp_player_joined', {
            seats: state.seats.length,
            rejoin: outcome.rejoin,
          });
        }
        return;
      }
    }
  };

  const onConnection = (socket: TcpConnection) => {
    const conn: Conn = { id: uuidV4(), socket, lastSeen: now(), seated: false };
    const split = createLineBuffer();
    conns.set(conn.id, conn);
    socket.setEncoding('utf8');
    socket.on('data', data => {
      conn.lastSeen = now();
      for (const line of split(data.toString())) {
        if (conns.get(conn.id) !== conn) {
          return;
        }
        onLine(conn, line);
      }
    });
    socket.on('close', () => drop(conn));
    socket.on('error', () => drop(conn));
  };

  const checkSilence = () => {
    const time = now();
    Array.from(conns.values()).forEach(conn => {
      if (time - conn.lastSeen > SILENCE_TIMEOUT_MS) {
        conn.socket.destroy();
        drop(conn);
      }
    });
  };

  const stop = () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    Array.from(conns.values()).forEach(hangUp);
    server?.close();
    server = null;
    zeroconf.unpublishService(serviceName);
  };

  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        const listening = TcpSocket.createServer(onConnection);
        server = listening;
        listening.once('error', reject);
        listening.listen({ port: CAMP_PORT, host: '0.0.0.0' }, () => {
          ticker = setInterval(checkSilence, PING_INTERVAL_MS);
          zeroconf.publishService(
            SERVICE_TYPE,
            'tcp',
            'local.',
            serviceName,
            CAMP_PORT,
            { code: state.code },
          );
          resolve();
        });
      }),
    remove: seatId => {
      const outcome = apply({ type: 'remove', seatId });
      if (outcome.kind === 'freed') {
        freed(outcome, { type: 'removed' });
        qaLog('camp_player_removed', { seats: state.seats.length });
        if (applyGame({ type: 'seatRemoved', seatId })) {
          broadcastGame(false);
          revealIfAllVoted();
        }
      }
    },
    startGame: (kind, settings, rng = Math.random) => {
      const players = roundSeats(gameSeats()).length;
      if (game || !inRange(kind, players)) {
        return;
      }
      const ids = draw(kind, settings.packId, rng);
      if (
        !ids ||
        !applyGame({
          type: 'start',
          game: kind,
          settings,
          seats: gameSeats(),
          ids,
          rng,
        })
      ) {
        return;
      }
      broadcastGame(true);
      qaLog('camp_game_started', { game: kind, players });
      qaLog('camp_round_started', { game: kind, round: 1 });
    },
    newRound: (rng = Math.random) => {
      if (!game) {
        return;
      }
      const ids = draw(game.game, game.settings.packId, rng);
      if (
        !ids ||
        !applyGame({ type: 'newRound', seats: gameSeats(), ids, rng }) ||
        !game
      ) {
        return;
      }
      broadcastGame(true);
      qaLog('camp_round_started', { game: game.game, round: game.round });
    },
    vote: (seatId, pick) => {
      if (game) {
        vote(seatId, game.round, game.qIndex, pick);
      }
    },
    revealVotes: () => revealVotes(true),
    nextQuestion: () => {
      if (applyGame({ type: 'wyrNext' })) {
        broadcastGame(false);
      }
    },
    showMine: seatId => {
      if (game) {
        showMine(seatId, game.round);
      }
    },
    reveal: () => {
      if (!game || !applyGame({ type: 'reveal' })) {
        return;
      }
      broadcastGame(false);
      qaLog('camp_imposter_revealed', { imposters: game.imposterSeats.length });
    },
    endGame: () => {
      const ended = game;
      if (!ended || !applyGame({ type: 'end' })) {
        return;
      }
      conns.forEach(conn => {
        if (conn.seated) {
          send(conn, { type: 'lobby' });
        }
      });
      qaLog('camp_game_ended', { game: ended.game, rounds: ended.round });
    },
    close: () => {
      apply({ type: 'close' });
      conns.forEach(conn => send(conn, { type: 'closed' }));
      stop();
    },
    stop,
  };
}
