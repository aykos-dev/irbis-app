import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';

import { qaLog } from '../../../shared/utils/qaLog';
import { uuidV4 } from '../../../shared/utils/uuid';
import {
  gameReducer,
  idsNeeded,
  inRange,
  roundSeats,
  toMafiaPublic,
  toPublic,
  toXoPublic,
  xoRange,
  type GameSeat,
  type GameSettings,
  type HostAction,
  type HostGame,
  type XoState,
} from '../games/gameReducer';
import {
  mafiaRange,
  teamCounts,
  type MafiaSettings,
} from '../games/mafia/roles';
import { findPack, type PartyGame } from '../games/packs';
import { drawIds, type Rng } from '../games/usedStore';
import {
  CAMP_PORT,
  createLineBuffer,
  decodeClient,
  encode,
  PING_INTERVAL_MS,
  SILENCE_TIMEOUT_MS,
  type MafiaWinner,
  type OutgoingHostMessage,
  type WyrPick,
} from '../protocol/codec';
import {
  HOST_SEAT_ID,
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

/** A closing message gets this long to leave the write queue before the socket is destroyed. */
const HANGUP_FLUSH_MS = 1000;

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
  /** Mafia: deals one role to each connected player (host excluded) when the room has 6–15 seats. */
  startMafia: (settings: MafiaSettings, rng?: Rng) => void;
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
  /** X and O: the host is X, the one other connected seat O; only with exactly 2 seats. */
  startXo: () => void;
  /** X and O: a seat's move (the host's own taps included); ignored unless valid (AC2). */
  xoMove: (seatId: string, cell: number) => void;
  /** X and O: the next game after a result, marks swapped, X first (AC4; the host's own tap). */
  xoNext: () => void;
  /** X and O: the host ends the series; both phones show the final score (AC7). */
  xoEnd: () => void;
  /** X and O, after the final score: a fresh series, else back to the lobby (AC7). */
  xoPlayAgain: () => void;
  /** Mafia: Night n → Day n → Night n+1. */
  mafPhaseNext: () => void;
  /** Mafia: the narrator marks a player out (killed at night, exiled by day). */
  mafMarkOut: (seatId: string) => void;
  /** Mafia: the narrator takes a mark back. */
  mafMarkBack: (seatId: string) => void;
  /** Mafia: game over with `winner` — every phone gets all roles and the result (AC6). */
  mafEnd: (winner: MafiaWinner) => void;
  /** Mafia, after game over: a new deal over the connected players, else back to the lobby (setup). */
  mafPlayAgain: (rng?: Rng) => void;
};

type Options = {
  room: RoomState;
  /** Network name players see after a probe ("Connected to …"): hotspot SSID or Wi-Fi name. */
  network?: string;
  /** A running game restored with the room (resume). */
  game?: HostGame | null;
  onChange: (room: RoomState, game: HostGame | null) => void;
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
  /** Seat tokens the host has freed: a retry with one gets `removed`, never a new seat (CORE-3). */
  const removedTokens = new Set<string>();
  const zeroconf = new Zeroconf();
  const serviceName = `irbis-${room.code}`;

  const send = (conn: Conn, message: OutgoingHostMessage) => {
    conn.socket.write(encode(message));
  };

  const hangUp = (conn: Conn) => {
    conns.delete(conn.id);
    conn.socket.destroy();
  };

  /** Writes a last message and closes only after it has flushed (a destroy straight after write can drop it). */
  const sendAndHangUp = (conn: Conn, message: OutgoingHostMessage) => {
    let closed = false;
    const done = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearTimeout(timer);
      hangUp(conn);
    };
    const timer = setTimeout(done, HANGUP_FLUSH_MS);
    try {
      conn.socket.write(encode(message), 'utf8', done);
    } catch {
      done();
    }
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
    if (game.game === 'mafia') {
      const secret = seatId ? game.deals[seatId] : undefined;
      if (withDeal && secret) {
        send(conn, { type: 'deal', game: 'mafia', round: game.round, secret });
      }
      send(conn, {
        type: 'game',
        game: 'mafia',
        round: game.round,
        phase: game.phase,
        public: toMafiaPublic(game),
      });
      return;
    }
    if (game.game === 'xo') {
      send(conn, {
        type: 'game',
        game: 'xo',
        round: game.round,
        public: toXoPublic(game),
      });
      return;
    }
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

  const applyGame = (action: HostAction): boolean => {
    const next = gameReducer(game, action);
    if (next === game) {
      return false;
    }
    game = next;
    onChange(state, game);
    return true;
  };

  /** The game now (read after `applyGame`, which replaces it). */
  const current = (): HostGame | null => game;

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
    const secret = game?.game === 'whoami' ? game.deals[seatId] : undefined;
    const conn = connOf(seatId);
    if (game && game.game === 'whoami' && secret && conn) {
      send(conn, { type: 'deal', game: game.game, round: game.round, secret });
    }
    qaLog('camp_whoami_show_mine', { round });
  };

  /** X and O: applies a move; an accepted one goes to every phone and is logged, with the result if it ended the game. */
  const xoMove = (seatId: string, round: number, gameNo: number, cell: number) => {
    const before = game;
    if (
      before?.game !== 'xo' ||
      !applyGame({ type: 'xoMove', seatId, round, gameNo, cell })
    ) {
      return;
    }
    broadcastGame(false);
    const next = current();
    if (next?.game !== 'xo') {
      return;
    }
    qaLog('xo_move', {
      gameNo: next.gameNo,
      cell,
      mark: seatId === next.xSeatId ? 'x' : 'o',
    });
    logXoResult(next);
  };

  /** X and O: "Next game" from either phone; ignored without a result or for an old game (AC4). */
  const xoNext = (round: number, gameNo: number) => {
    if (game?.game !== 'xo' || !applyGame({ type: 'xoNext', round, gameNo })) {
      return;
    }
    broadcastGame(false);
    const next = current();
    if (next?.game === 'xo') {
      qaLog('xo_next', { gameNo: next.gameNo });
    }
  };

  /** X and O: pauses while a player's seat reconnects and resumes when it is back (AC6). */
  const syncXoPresence = () => {
    const seats = gameSeats().filter(seat =>
      state.seats.some(own => own.seatId === seat.seatId),
    );
    if (game?.game !== 'xo' || !applyGame({ type: 'xoPresence', seats })) {
      return;
    }
    broadcastGame(false);
    const next = current();
    if (next?.game === 'xo') {
      qaLog('xo_paused', { paused: next.paused });
    }
  };

  /** X and O: the final score went to both phones (host End or the other player removed). */
  const logXoEnded = (next: HostGame | null) => {
    if (next?.game === 'xo' && next.ended) {
      qaLog('camp_game_ended', {
        game: 'xo',
        games: next.ended.games,
        draws: next.ended.draws,
      });
    }
  };

  const logXoResult = ({ result, gameNo }: XoState) => {
    if (result?.kind === 'win') {
      qaLog('xo_result', { gameNo, kind: 'win', mark: result.mark });
    } else if (result?.kind === 'draw') {
      qaLog('xo_result', { gameNo, kind: 'draw' });
    }
  };

  const apply = (action: RoomAction): RoomOutcome => {
    const result = roomReducer(state, action);
    if (result.state !== state) {
      state = result.state;
      onChange(state, game);
      if (!state.closed) {
        broadcastRoster();
        syncXoPresence();
      }
    }
    return result.outcome;
  };

  const freed = (
    outcome: RoomOutcome,
    message: OutgoingHostMessage | null,
    seatToken?: string,
  ) => {
    if (seatToken) {
      removedTokens.add(seatToken);
    }
    if (outcome.kind !== 'freed' || !outcome.connId) {
      return;
    }
    const conn = conns.get(outcome.connId);
    if (conn) {
      if (message) {
        sendAndHangUp(conn, message);
      } else {
        hangUp(conn);
      }
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
        sendAndHangUp(conn, { type: 'rejected', reason: 'version' });
      }
      return;
    }
    const message = decoded.message;
    switch (message.type) {
      case 'ping':
        send(conn, { type: 'pong' });
        return;
      case 'leave': {
        const leaving = state.seats.find(seat => seat.connId === conn.id);
        const seatId = seatOf(conn);
        freed(apply({ type: 'leave', connId: conn.id }), null, leaving?.seatToken);
        const wasEnded = game?.game === 'xo' && game.ended !== undefined;
        if (seatId && applyGame({
          type: 'seatRemoved',
          seatId,
          ...(leaving
            ? { player: { nickname: leaving.nickname, avatar: leaving.avatar } }
            : {}),
        })) {
          broadcastGame(false);
          revealIfAllVoted();
          if (!wasEnded) {
            logXoEnded(current());
          }
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
      case 'xoMove': {
        const seatId = seatOf(conn);
        if (seatId) {
          xoMove(seatId, message.round, message.gameNo, message.cell);
        }
        return;
      }
      case 'xoNext':
        if (seatOf(conn)) {
          xoNext(message.round, message.gameNo);
        }
        return;
      case 'mafReady': {
        const seatId = seatOf(conn);
        if (
          seatId &&
          applyGame({ type: 'mafReady', seatId, round: message.round })
        ) {
          broadcastGame(false);
          const next = current();
          if (next?.game === 'mafia') {
            qaLog('maf_ready', {
              ready: next.ready.length,
              players: next.players.length,
            });
          }
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
        if (message.seatToken && removedTokens.has(message.seatToken)) {
          // The host already freed this seat (a lost `removed`): never hand the retry a new one.
          sendAndHangUp(conn, { type: 'removed' });
          return;
        }
        const outcome = apply({
          type: 'hello',
          connId: conn.id,
          hello: message,
          seatToken: uuidV4(),
        });
        if (outcome.kind === 'rejected') {
          sendAndHangUp(conn, { type: 'rejected', reason: outcome.reason });
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

  /** Everyone back to the lobby (a Mafia game over was already logged by `mafEnd`). */
  const endGame = () => {
    const ended = game;
    if (!ended || !applyGame({ type: 'end' })) {
      return;
    }
    conns.forEach(conn => {
      if (conn.seated) {
        send(conn, { type: 'lobby' });
      }
    });
    if (ended.game === 'xo') {
      if (!ended.ended) {
        const wins = Object.values(ended.score).reduce((sum, n) => sum + n, 0);
        qaLog('camp_game_ended', {
          game: 'xo',
          games: wins + ended.draws,
          draws: ended.draws,
        });
      }
      return;
    }
    if (ended.game !== 'mafia' || !ended.ended) {
      qaLog('camp_game_ended', { game: ended.game, rounds: ended.round });
    }
  };

  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        const listening = TcpSocket.createServer(onConnection);
        server = listening;
        listening.once('error', reject);
        listening.listen({ port: CAMP_PORT, host: '0.0.0.0' }, () => {
          ticker = setInterval(checkSilence, PING_INTERVAL_MS);
          syncXoPresence();
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
      const seat = state.seats.find(candidate => candidate.seatId === seatId);
      const outcome = apply({ type: 'remove', seatId });
      if (outcome.kind === 'freed') {
        freed(outcome, { type: 'removed' }, seat?.seatToken);
        qaLog('camp_player_removed', { seats: state.seats.length });
        const wasEnded = game?.game === 'xo' && game.ended !== undefined;
        if (applyGame({
          type: 'seatRemoved',
          seatId,
          ...(seat
            ? { player: { nickname: seat.nickname, avatar: seat.avatar } }
            : {}),
        })) {
          broadcastGame(false);
          revealIfAllVoted();
          if (!wasEnded) {
            logXoEnded(current());
          }
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
    startMafia: (settings, rng = Math.random) => {
      const seats = gameSeats();
      const room = roundSeats(seats).length;
      if (game || room < mafiaRange.min || room > mafiaRange.max) {
        return;
      }
      const hostSeats = new Set(
        state.seats.filter(seat => seat.host).map(seat => seat.seatId),
      );
      const started = applyGame({
        type: 'startMafia',
        settings,
        seats: seats.filter(seat => !hostSeats.has(seat.seatId)),
        rng,
      })
        ? current()
        : null;
      if (started?.game !== 'mafia') {
        return;
      }
      broadcastGame(true);
      const players = started.players.length;
      const teams = teamCounts(settings.counts, players);
      qaLog('camp_game_started', { game: 'mafia', players });
      qaLog('maf_dealt', {
        players,
        mafia: teams.mafia,
        town: teams.town,
        solo: teams.solo,
      });
    },
    startXo: () => {
      const players = roundSeats(gameSeats()).length;
      if (game || players < xoRange.min || players > xoRange.max) {
        return;
      }
      if (
        !applyGame({ type: 'startXo', seats: gameSeats(), hostSeatId: HOST_SEAT_ID })
      ) {
        return;
      }
      broadcastGame(false);
      qaLog('camp_game_started', { game: 'xo', players });
    },
    xoMove: (seatId, cell) => {
      if (game?.game === 'xo') {
        xoMove(seatId, game.round, game.gameNo, cell);
      }
    },
    xoNext: () => {
      if (game?.game === 'xo') {
        xoNext(game.round, game.gameNo);
      }
    },
    xoEnd: () => {
      if (game?.game !== 'xo' || !applyGame({ type: 'xoEnd' })) {
        return;
      }
      broadcastGame(false);
      logXoEnded(current());
    },
    xoPlayAgain: () => {
      if (game?.game !== 'xo' || !game.ended) {
        return;
      }
      if (
        !applyGame({
          type: 'xoPlayAgain',
          seats: gameSeats(),
          hostSeatId: HOST_SEAT_ID,
        })
      ) {
        endGame();
        return;
      }
      broadcastGame(false);
      const next = current();
      if (next?.game === 'xo') {
        qaLog('camp_round_started', { game: 'xo', round: next.round });
      }
    },
    newRound: (rng = Math.random) => {
      if (!game || game.game === 'mafia' || game.game === 'xo') {
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
    mafPlayAgain: (rng = Math.random) => {
      if (game?.game !== 'mafia' || !game.ended) {
        return;
      }
      const hostSeats = new Set(
        state.seats.filter(seat => seat.host).map(seat => seat.seatId),
      );
      const seats = gameSeats().filter(seat => !hostSeats.has(seat.seatId));
      if (!applyGame({ type: 'playAgain', seats, rng })) {
        endGame();
        return;
      }
      broadcastGame(true);
      const next = current();
      if (next?.game === 'mafia') {
        qaLog('camp_round_started', { game: 'mafia', round: next.round });
      }
    },
    vote: (seatId, pick) => {
      if (game?.game === 'rather') {
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
    mafPhaseNext: () => {
      if (game?.game !== 'mafia' || !applyGame({ type: 'mafPhaseNext' })) {
        return;
      }
      broadcastGame(false);
      const next = current();
      if (next?.game === 'mafia') {
        qaLog('maf_phase', { kind: next.phase.kind, n: next.phase.n });
      }
    },
    mafMarkOut: seatId => {
      if (game?.game !== 'mafia') {
        return;
      }
      const { phase } = game;
      const reason = phase.kind === 'night' ? 'killed' : 'exiled';
      if (!applyGame({ type: 'mafMarkOut', seatId, reason })) {
        return;
      }
      broadcastGame(false);
      qaLog('maf_out', { reason, phase: phase.kind });
    },
    mafMarkBack: seatId => {
      if (
        game?.game !== 'mafia' ||
        !applyGame({ type: 'mafMarkBack', seatId })
      ) {
        return;
      }
      broadcastGame(false);
      qaLog('maf_back');
    },
    reveal: () => {
      if (
        !game ||
        !applyGame({ type: 'reveal' }) ||
        game.game === 'mafia' ||
        game.game === 'xo'
      ) {
        return;
      }
      broadcastGame(false);
      qaLog('camp_imposter_revealed', { imposters: game.imposterSeats.length });
    },
    mafEnd: winner => {
      if (game?.game !== 'mafia' || !applyGame({ type: 'end', winner })) {
        return;
      }
      broadcastGame(false);
      qaLog('camp_game_ended', {
        game: 'mafia',
        rounds: game.round,
        winner,
      });
    },
    endGame,
    close: () => {
      apply({ type: 'close' });
      let remaining = conns.size;
      let stopped = false;
      const finish = () => {
        if (stopped) {
          return;
        }
        stopped = true;
        clearTimeout(timer);
        stop();
      };
      const oneDone = () => {
        remaining -= 1;
        if (remaining <= 0) {
          finish();
        }
      };
      const timer = setTimeout(finish, HANGUP_FLUSH_MS);
      if (remaining === 0) {
        finish();
        return;
      }
      conns.forEach(conn => {
        try {
          conn.socket.write(encode({ type: 'closed' }), 'utf8', oneDone);
        } catch {
          oneDone();
        }
      });
    },
    stop,
  };
}
