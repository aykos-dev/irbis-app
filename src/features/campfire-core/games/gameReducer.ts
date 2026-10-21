import { z } from 'zod';

import {
  crocPhaseSchema,
  crocResultSchema,
  crocTotalsSchema,
  crocWordSchema,
  gamePhaseSchema,
  mafiaOutSchema,
  mafiaPhaseSchema,
  mafiaSecretSchema,
  mafiaWinnerSchema,
  partyGameSchema,
  secretSchema,
  wyrPickSchema,
  xoPublicSchema,
  type CrocPhase,
  type CrocPublic,
  type CrocResult,
  type CrocSecret,
  type CrocWord,
  type MafiaOutPlayer,
  type MafiaPublic,
  type MafiaSecret,
  type MafiaWinner,
  type PublicGame,
  type Secret,
  type WyrPick,
  type XoPublic,
} from '../protocol/codec';
import {
  dealBlocked,
  dealRoles,
  mafiaCountsSchema,
  type MafiaSettings,
} from './mafia/roles';
import { dealtRoles } from './mafia/winCheck';
import type { PackGame, PartyGame } from './packs';
import { shuffle, type Rng } from './usedStore';
import { emptyBoard, findWin, isFull } from './xo/xoRules';

/** Players per game, host included (spec AC1; Crocodile: the host plays too). */
export const playerRange: Record<PackGame, { min: number; max: number }> = {
  imposter: { min: 3, max: 15 },
  whoami: { min: 3, max: 12 },
  rather: { min: 2, max: 15 },
  croc: { min: 3, max: 15 },
};

/** X and O: exactly 2 players, host included (campfire-xo AC1). */
export const xoRange = { min: 2, max: 2 } as const;

/** Would you rather questions per round. */
export const RATHER_PER_ROUND = 20;
/** Two imposters only with at least this many players. */
export const TWO_IMPOSTERS_FROM = 8;

export const gameSettingsSchema = z.object({
  packId: z.string().min(1),
  imposters: z.number().int().min(1).max(2),
  showCategory: z.boolean(),
});
export type GameSettings = z.infer<typeof gameSettingsSchema>;

/** A party game's host state (saved with the room for resume). Secrets live in `deals` only. */
export const gameStateSchema = z.object({
  game: partyGameSchema,
  settings: gameSettingsSchema,
  round: z.number().int().min(1),
  phase: gamePhaseSchema,
  /** Seats dealt into this round. */
  players: z.array(z.string()),
  /** Seats that joined mid-round; dealt on the next `newRound`. */
  waiting: z.array(z.string()),
  deals: z.record(z.string(), secretSchema),
  imposterSeats: z.array(z.string()),
  /** Imposter: the round's word and the clue order (shuffled once per round). */
  wordId: z.string().optional(),
  order: z.array(z.string()).optional(),
  questions: z.array(z.string()),
  qIndex: z.number().int().min(0),
  votes: z.record(z.string(), wyrPickSchema),
});
export type GameState = z.infer<typeof gameStateSchema>;

/** Mafia host state: the host narrates and is never dealt; `players` are the dealt seats. */
export const mafiaStateSchema = z.object({
  game: z.literal('mafia'),
  round: z.number().int().min(1),
  phase: mafiaPhaseSchema,
  players: z.array(z.string()),
  /** Joined mid-game: they play the next game. */
  waiting: z.array(z.string()),
  deals: z.record(z.string(), mafiaSecretSchema),
  counts: mafiaCountsSchema,
  revealOut: z.boolean(),
  /** Seats that sent `mafReady` (the host shows the ticks during Night 1). */
  ready: z.array(z.string()),
  /** `roleId` is stored only when the host reveals roles of players who are out. */
  out: z.array(mafiaOutSchema),
  /** Game over (AC6): every phone shows the result until the host plays again or goes to the lobby. */
  ended: z.object({ winner: mafiaWinnerSchema }).optional(),
});
export type MafiaState = z.infer<typeof mafiaStateSchema>;

/** X and O host state: the public board plus who plays (`players`) and who joined to watch (`waiting`). */
export const xoStateSchema = xoPublicSchema.extend({
  game: z.literal('xo'),
  round: z.number().int().min(1),
  players: z.array(z.string()),
  waiting: z.array(z.string()),
});
export type XoState = z.infer<typeof xoStateSchema>;

/** Crocodile turn lengths offered in the lobby (seconds); 60 is the default. */
export const crocDurations = [30, 60, 90] as const;
export const CROC_DEFAULT_SEC = 60;
/** How long every phone shows a turn's result before "who shows next?". */
export const CROC_RESULT_MS = 3000;

export const crocSettingsSchema = z.object({
  durationSec: z.number().int().min(1),
  packs: z.array(z.string().min(1)).min(1),
});
export type CrocSettings = z.infer<typeof crocSettingsSchema>;

export type { CrocWord };

/** Crocodile host state: `packs` and `word` never leave the host except as the describer's secret. */
export const crocStateSchema = crocSettingsSchema.extend({
  game: z.literal('croc'),
  round: z.number().int().min(1),
  phase: crocPhaseSchema,
  turnNo: z.number().int().min(0),
  totals: crocTotalsSchema,
  describerSeatId: z.string().min(1).optional(),
  word: crocWordSchema.optional(),
  /** Running: when the turn ends, on the host's clock (ms). */
  endsAt: z.number().optional(),
  result: crocResultSchema.optional(),
});
export type CrocState = z.infer<typeof crocStateSchema>;

/** The host's running game: party, Mafia, X and O or Crocodile (saved with the room for resume). */
export const hostGameSchema = z.discriminatedUnion('game', [
  gameStateSchema,
  mafiaStateSchema,
  xoStateSchema,
  crocStateSchema,
]);
export type HostGame = z.infer<typeof hostGameSchema>;

export type GameSeat = { seatId: string; connected: boolean };

export type GameAction =
  /** `ids`: pack items drawn for the round (see `idsNeeded` and `drawIds`). */
  | {
      type: 'start';
      game: PartyGame;
      settings: GameSettings;
      seats: GameSeat[];
      ids: string[];
      rng: Rng;
    }
  | { type: 'newRound'; seats: GameSeat[]; ids: string[]; rng: Rng }
  /** Back to the lobby; Mafia with a `winner` stays on its game-over screen instead. */
  | { type: 'end'; winner?: MafiaWinner }
  | { type: 'seatJoined'; seatId: string }
  /** `player` is the leaving seat's name snapshot, kept on a Mafia out entry (AC5, AC6). */
  | { type: 'seatRemoved'; seatId: string; player?: MafiaOutPlayer }
  | { type: 'reveal' }
  /** Who am I: the seat asks for its own character. */
  | { type: 'showMine'; seatId: string; round: number }
  | {
      type: 'wyrVote';
      seatId: string;
      round: number;
      qIndex: number;
      pick: WyrPick;
    }
  | { type: 'wyrReveal' }
  | { type: 'wyrNext' };

export type MafiaAction =
  /** `seats` are the players only (host excluded). */
  | { type: 'startMafia'; settings: MafiaSettings; seats: GameSeat[]; rng: Rng }
  | { type: 'mafReady'; seatId: string; round: number }
  /** Night n → Day n → Night n+1. */
  | { type: 'mafPhaseNext' }
  /** The narrator marks a player out: killed at night, exiled by day. */
  | { type: 'mafMarkOut'; seatId: string; reason: 'killed' | 'exiled' }
  | { type: 'mafMarkBack'; seatId: string }
  /** After game over: same counts and reveal setting, a new deal over `seats` (players only). */
  | { type: 'playAgain'; seats: GameSeat[]; rng: Rng };

export type XoAction =
  /** The host is X; the one other connected seat is O. */
  | { type: 'startXo'; seats: GameSeat[]; hostSeatId: string }
  | {
      type: 'xoMove';
      seatId: string;
      round: number;
      gameNo: number;
      cell: number;
    }
  /** Either phone's "Next game" once the current game has a result (AC4); `gameNo` is the finished game. */
  | { type: 'xoNext'; round: number; gameNo: number }
  /** Seat statuses changed: the series pauses while a player's seat is reconnecting (AC6). */
  | { type: 'xoPresence'; seats: GameSeat[] }
  /** The host's End (AC7): both phones show the final score. */
  | { type: 'xoEnd' }
  /** After the final score: a fresh series over the 2 connected seats, host X, next round (AC7). */
  | { type: 'xoPlayAgain'; seats: GameSeat[]; hostSeatId: string };

/** Crocodile. `word` is drawn by the host server (no-repeat store) before the action. */
export type CrocAction =
  | { type: 'startCroc'; settings: CrocSettings; seats: GameSeat[] }
  /** Host only: who shows next. */
  | { type: 'crocPick'; seatId: string; word: CrocWord }
  /** Describer only, current round and turn. */
  | {
      type: 'crocSkip';
      seatId: string;
      round: number;
      turnNo: number;
      word: CrocWord;
    }
  /** `now`: the host's clock, the turn ends `durationSec` later. */
  | {
      type: 'crocStart';
      seatId: string;
      round: number;
      turnNo: number;
      now: number;
    }
  | { type: 'crocGuessed'; seatId: string; round: number; turnNo: number }
  /** The host's turn timer ran out for turn `turnNo`. */
  | { type: 'crocTimeUp'; turnNo: number }
  /** A seat disconnected or was removed; `name` shows on every phone when it was the describer. */
  | { type: 'crocLeft'; seatId: string; name: string }
  /** Result shown: back to "who shows next?". */
  | { type: 'crocNext' }
  /** Host: game over, every phone shows the totals. */
  | { type: 'crocEnd' }
  /** The host app restarted with this game saved. */
  | { type: 'resumed' };

export type HostAction = GameAction | MafiaAction | XoAction | CrocAction;

/** Players in a round: the seats connected when it starts, host included. */
export function roundSeats(seats: GameSeat[]): string[] {
  return seats.filter(seat => seat.connected).map(seat => seat.seatId);
}

export function inRange(game: PackGame, players: number): boolean {
  const { min, max } = playerRange[game];
  return players >= min && players <= max;
}

/** Pack items a round needs: one word, one character per player, or 20 questions. */
export function idsNeeded(game: PartyGame, players: number): number {
  switch (game) {
    case 'imposter':
      return 1;
    case 'whoami':
      return players;
    case 'rather':
      return RATHER_PER_ROUND;
  }
}

type Dealt = Pick<
  GameState,
  'phase' | 'deals' | 'imposterSeats' | 'questions' | 'qIndex' | 'votes'
> &
  Partial<Pick<GameState, 'wordId' | 'order'>>;

function deal(
  game: PartyGame,
  settings: GameSettings,
  players: string[],
  ids: string[],
  rng: Rng,
): Dealt | null {
  if (ids.length < idsNeeded(game, players.length)) {
    return null;
  }
  const empty = { imposterSeats: [], questions: [], qIndex: 0, votes: {} };
  switch (game) {
    case 'imposter': {
      const count =
        settings.imposters === 2 && players.length >= TWO_IMPOSTERS_FROM
          ? 2
          : 1;
      const imposterSeats = shuffle(players, rng).slice(0, count);
      const base = {
        packId: settings.packId,
        showCategory: settings.showCategory,
      };
      const deals: Record<string, Secret> = {};
      players.forEach(seatId => {
        deals[seatId] = imposterSeats.includes(seatId)
          ? { role: 'imposter', ...base }
          : { role: 'word', wordId: ids[0], ...base };
      });
      return {
        ...empty,
        phase: 'dealt',
        deals,
        imposterSeats,
        wordId: ids[0],
        order: shuffle(players, rng),
      };
    }
    case 'whoami': {
      const characters = shuffle(ids, rng);
      const own = new Map(
        players.map((seatId, i) => [seatId, characters[i] ?? '']),
      );
      const deals: Record<string, Secret> = {};
      players.forEach(seatId => {
        deals[seatId] = {
          others: players
            .filter(other => other !== seatId)
            .map(other => ({
              seatId: other,
              characterId: own.get(other) ?? '',
            })),
        };
      });
      return { ...empty, phase: 'dealt', deals };
    }
    case 'rather':
      return {
        ...empty,
        phase: 'voting',
        deals: {},
        questions: ids.slice(0, RATHER_PER_ROUND),
      };
  }
}

/**
 * The party-game engine on the host (pure). Players are fixed per round; a seat joining mid-round
 * waits for the next one, a reconnecting seat keeps its deal. `null` = no game (lobby).
 */
export function gameReducer(
  state: GameState | null,
  action: GameAction,
): GameState | null;
export function gameReducer(
  state: HostGame | null,
  action: HostAction,
): HostGame | null;
export function gameReducer(
  state: HostGame | null,
  action: HostAction,
): HostGame | null {
  if (action.type === 'start') {
    const players = roundSeats(action.seats);
    const dealt = deal(
      action.game,
      action.settings,
      players,
      action.ids,
      action.rng,
    );
    if (!dealt) {
      return state;
    }
    return {
      game: action.game,
      settings: action.settings,
      round: 1,
      players,
      waiting: [],
      ...dealt,
    };
  }
  if (action.type === 'startMafia') {
    return startMafia(action.settings, action.seats, action.rng) ?? state;
  }
  if (action.type === 'startXo') {
    return startXo(action.seats, action.hostSeatId) ?? state;
  }
  if (action.type === 'startCroc') {
    return startCroc(action.settings, action.seats) ?? state;
  }
  if (!state) {
    return state;
  }
  if (state.game === 'mafia') {
    return mafiaReducer(state, action);
  }
  if (state.game === 'xo') {
    return xoReducer(state, action);
  }
  if (state.game === 'croc') {
    return crocReducer(state, action);
  }
  switch (action.type) {
    case 'xoMove':
    case 'xoNext':
    case 'xoPresence':
    case 'xoEnd':
    case 'xoPlayAgain':
    case 'crocPick':
    case 'crocSkip':
    case 'crocStart':
    case 'crocGuessed':
    case 'crocTimeUp':
    case 'crocLeft':
    case 'crocNext':
    case 'crocEnd':
    case 'resumed':
    case 'mafReady':
    case 'mafPhaseNext':
    case 'mafMarkOut':
    case 'mafMarkBack':
    case 'playAgain':
      return state;
    case 'newRound': {
      const players = roundSeats(action.seats);
      const dealt = deal(
        state.game,
        state.settings,
        players,
        action.ids,
        action.rng,
      );
      if (!dealt) {
        return state;
      }
      return {
        ...state,
        round: state.round + 1,
        players,
        waiting: [],
        ...dealt,
      };
    }
    case 'end':
      return null;
    case 'seatJoined':
      if (
        state.players.includes(action.seatId) ||
        state.waiting.includes(action.seatId)
      ) {
        return state;
      }
      return { ...state, waiting: [...state.waiting, action.seatId] };
    case 'seatRemoved': {
      if (
        !state.players.includes(action.seatId) &&
        !state.waiting.includes(action.seatId)
      ) {
        return state;
      }
      const { [action.seatId]: _deal, ...deals } = state.deals;
      const { [action.seatId]: _vote, ...votes } = state.votes;
      return {
        ...state,
        players: state.players.filter(seat => seat !== action.seatId),
        waiting: state.waiting.filter(seat => seat !== action.seatId),
        ...(state.order
          ? { order: state.order.filter(seat => seat !== action.seatId) }
          : {}),
        deals,
        votes,
      };
    }
    case 'reveal':
      return state.game === 'imposter' && state.phase === 'dealt'
        ? { ...state, phase: 'revealed' }
        : state;
    case 'showMine': {
      const own = state.deals[action.seatId];
      if (
        state.game !== 'whoami' ||
        action.round !== state.round ||
        !own ||
        !('others' in own) ||
        own.mine
      ) {
        return state;
      }
      const mine = Object.values(state.deals)
        .flatMap(dealt => ('others' in dealt ? dealt.others : []))
        .find(other => other.seatId === action.seatId)?.characterId;
      if (!mine) {
        return state;
      }
      return {
        ...state,
        deals: { ...state.deals, [action.seatId]: { ...own, mine } },
      };
    }
    case 'wyrVote':
      if (
        state.game !== 'rather' ||
        state.phase !== 'voting' ||
        action.round !== state.round ||
        action.qIndex !== state.qIndex ||
        !state.players.includes(action.seatId)
      ) {
        return state;
      }
      return {
        ...state,
        votes: { ...state.votes, [action.seatId]: action.pick },
      };
    case 'wyrReveal':
      return state.game === 'rather' && state.phase === 'voting'
        ? { ...state, phase: 'revealed' }
        : state;
    case 'wyrNext':
      if (
        state.game !== 'rather' ||
        state.qIndex + 1 >= state.questions.length
      ) {
        return state;
      }
      return { ...state, qIndex: state.qIndex + 1, votes: {}, phase: 'voting' };
  }
}

function startMafia(
  settings: MafiaSettings,
  seats: GameSeat[],
  rng: Rng,
  round = 1,
): MafiaState | null {
  const players = roundSeats(seats);
  if (dealBlocked(settings.counts, players.length)) {
    return null;
  }
  const roles = dealRoles(settings.counts, players, rng);
  const deals: Record<string, MafiaSecret> = {};
  players.forEach(seatId => {
    const roleId = roles[seatId];
    if (roleId) {
      deals[seatId] = { roleId };
    }
  });
  return {
    game: 'mafia',
    round,
    phase: { kind: 'night', n: 1 },
    players,
    waiting: [],
    deals,
    counts: settings.counts,
    revealOut: settings.revealOut,
    ready: [],
    out: [],
  };
}

/** Mafia: a mid-game joiner waits for the next game; a removed player is out (exiled) this phase. */
function mafiaReducer(state: MafiaState, action: HostAction): MafiaState | null {
  if (state.ended) {
    return endedReducer(state, action);
  }
  switch (action.type) {
    case 'end':
      return action.winner ? { ...state, ended: { winner: action.winner } } : null;
    case 'seatJoined':
      if (
        state.players.includes(action.seatId) ||
        state.waiting.includes(action.seatId)
      ) {
        return state;
      }
      return { ...state, waiting: [...state.waiting, action.seatId] };
    case 'seatRemoved':
      if (state.waiting.includes(action.seatId)) {
        return {
          ...state,
          waiting: state.waiting.filter(seat => seat !== action.seatId),
        };
      }
      if (
        !state.players.includes(action.seatId) ||
        state.out.some(entry => entry.seatId === action.seatId)
      ) {
        return state;
      }
      return {
        ...state,
        ready: state.ready.filter(seat => seat !== action.seatId),
        out: [
          ...state.out,
          {
            seatId: action.seatId,
            reason: 'exiled',
            phase: state.phase,
            ...(action.player ? { player: action.player } : {}),
          },
        ],
      };
    case 'mafReady':
      if (
        action.round !== state.round ||
        !state.players.includes(action.seatId) ||
        state.ready.includes(action.seatId) ||
        state.out.some(entry => entry.seatId === action.seatId)
      ) {
        return state;
      }
      return { ...state, ready: [...state.ready, action.seatId] };
    case 'mafPhaseNext':
      return {
        ...state,
        phase:
          state.phase.kind === 'night'
            ? { kind: 'day', n: state.phase.n }
            : { kind: 'night', n: state.phase.n + 1 },
      };
    case 'mafMarkOut': {
      if (
        !state.players.includes(action.seatId) ||
        state.out.some(entry => entry.seatId === action.seatId)
      ) {
        return state;
      }
      const roleId = state.deals[action.seatId]?.roleId;
      return {
        ...state,
        out: [
          ...state.out,
          {
            seatId: action.seatId,
            reason: action.reason,
            phase: state.phase,
            ...(state.revealOut && roleId ? { roleId } : {}),
          },
        ],
      };
    }
    case 'mafMarkBack':
      if (!state.out.some(entry => entry.seatId === action.seatId)) {
        return state;
      }
      return {
        ...state,
        out: state.out.filter(entry => entry.seatId !== action.seatId),
      };
    default:
      return state;
  }
}

/** Game over: only the lobby, play again and mid-game joiners still change the state. */
function endedReducer(state: MafiaState, action: HostAction): MafiaState | null {
  switch (action.type) {
    case 'end':
      return action.winner ? state : null;
    case 'playAgain':
      return (
        startMafia(
          { counts: state.counts, revealOut: state.revealOut },
          action.seats,
          action.rng,
          state.round + 1,
        ) ?? state
      );
    case 'seatJoined':
    case 'seatRemoved':
      return withWaiting(state, action);
    default:
      return state;
  }
}

/** A seat joining or leaving while the game is over only changes who waits for the next game. */
function withWaiting(
  state: MafiaState,
  action: Extract<HostAction, { type: 'seatJoined' | 'seatRemoved' }>,
): MafiaState {
  if (action.type === 'seatRemoved') {
    return state.waiting.includes(action.seatId)
      ? {
          ...state,
          waiting: state.waiting.filter(seat => seat !== action.seatId),
        }
      : state;
  }
  return state.waiting.includes(action.seatId) ||
    state.players.includes(action.seatId)
    ? state
    : { ...state, waiting: [...state.waiting, action.seatId] };
}

function startXo(
  seats: GameSeat[],
  hostSeatId: string,
  round = 1,
): XoState | null {
  const players = roundSeats(seats);
  const joiner = players.find(seat => seat !== hostSeatId);
  if (
    players.length < xoRange.min ||
    players.length > xoRange.max ||
    !players.includes(hostSeatId) ||
    !joiner
  ) {
    return null;
  }
  return {
    game: 'xo',
    round,
    players: [hostSeatId, joiner],
    waiting: [],
    board: emptyBoard(),
    xSeatId: hostSeatId,
    oSeatId: joiner,
    turn: 'x',
    result: null,
    score: { [hostSeatId]: 0, [joiner]: 0 },
    draws: 0,
    gameNo: 1,
    paused: false,
  };
}

function startCroc(settings: CrocSettings, seats: GameSeat[]): CrocState | null {
  if (!inRange('croc', roundSeats(seats).length) || settings.packs.length === 0) {
    return null;
  }
  return {
    game: 'croc',
    round: 1,
    phase: 'pick',
    turnNo: 0,
    durationSec: settings.durationSec,
    packs: settings.packs,
    totals: { guessed: 0, skipped: 0, turns: 0 },
  };
}

/**
 * X and O: moves and "Next game" change the board; a third phone waits (watches); the host's End
 * or removing the other player shows the final score; the lobby ends the game.
 */
function xoReducer(state: XoState, action: HostAction): XoState | null {
  switch (action.type) {
    case 'end':
      return null;
    case 'seatJoined':
      return state.players.includes(action.seatId) ||
        state.waiting.includes(action.seatId)
        ? state
        : { ...state, waiting: [...state.waiting, action.seatId] };
    case 'seatRemoved':
      if (state.waiting.includes(action.seatId)) {
        return {
          ...state,
          waiting: state.waiting.filter(seat => seat !== action.seatId),
        };
      }
      return state.players.includes(action.seatId) ? xoEnded(state) : state;
    case 'xoEnd':
      return xoEnded(state);
    case 'xoPlayAgain':
      return state.ended
        ? (startXo(action.seats, action.hostSeatId, state.round + 1) ?? state)
        : state;
    case 'xoPresence': {
      const paused = state.players.some(seatId =>
        action.seats.some(seat => seat.seatId === seatId && !seat.connected),
      );
      return state.ended || paused === state.paused
        ? state
        : { ...state, paused };
    }
    case 'xoNext':
      if (
        state.ended ||
        state.paused ||
        state.result === null ||
        action.round !== state.round ||
        action.gameNo !== state.gameNo
      ) {
        return state;
      }
      return {
        ...state,
        board: emptyBoard(),
        gameNo: state.gameNo + 1,
        xSeatId: state.oSeatId,
        oSeatId: state.xSeatId,
        turn: 'x',
        result: null,
      };
    case 'xoMove':
      return state.ended ? state : xoMove(state, action);
    default:
      return state;
  }
}

/**
 * A describer message counts only from the describer, for this round and turn (stale ones are dropped),
 * in `phases` (Skip: ready or running; Start: ready; Guessed!: running).
 */
export function fromDescriber(
  state: CrocState,
  seatId: string,
  round: number,
  turnNo: number,
  phases: CrocPhase[] = ['ready', 'running'],
): boolean {
  return (
    phases.includes(state.phase) &&
    seatId === state.describerSeatId &&
    round === state.round &&
    turnNo === state.turnNo
  );
}

/** The turn is over: everyone sees the word; a guess counts, a cancelled turn does not count at all. */
function turnOver(
  state: CrocState,
  kind: CrocResult['kind'],
  name?: string,
): CrocState {
  if (!state.word) {
    return state;
  }
  const { endsAt: _endsAt, ...rest } = state;
  const { totals } = state;
  return {
    ...rest,
    phase: 'result',
    result: { kind, word: state.word, ...(name ? { name } : {}) },
    totals:
      kind === 'cancelled'
        ? totals
        : {
            ...totals,
            guessed: totals.guessed + (kind === 'guessed' ? 1 : 0),
            turns: totals.turns + 1,
          },
  };
}

/** Back to "who shows next?": no describer, word or result. */
function toPick(state: CrocState): CrocState {
  const {
    describerSeatId: _describer,
    word: _word,
    endsAt: _endsAt,
    result: _result,
    ...rest
  } = state;
  return { ...rest, phase: 'pick' };
}

/** Crocodile: pick → ready (describer holds the word, may skip) → running → result → pick; ended. */
function crocReducer(state: CrocState, action: HostAction): CrocState | null {
  if (action.type === 'end') {
    return null;
  }
  if (state.phase === 'ended') {
    return action.type === 'playAgain'
      ? {
          ...toPick(state),
          round: state.round + 1,
          turnNo: 0,
          totals: { guessed: 0, skipped: 0, turns: 0 },
        }
      : state;
  }
  switch (action.type) {
    case 'crocPick':
      if (state.phase !== 'pick') {
        return state;
      }
      return {
        ...state,
        phase: 'ready',
        turnNo: state.turnNo + 1,
        describerSeatId: action.seatId,
        word: action.word,
      };
    case 'crocSkip':
      if (!fromDescriber(state, action.seatId, action.round, action.turnNo)) {
        return state;
      }
      return {
        ...state,
        word: action.word,
        totals: { ...state.totals, skipped: state.totals.skipped + 1 },
      };
    case 'crocStart':
      if (
        !fromDescriber(state, action.seatId, action.round, action.turnNo, [
          'ready',
        ])
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'running',
        endsAt: action.now + state.durationSec * 1000,
      };
    case 'crocGuessed':
      return fromDescriber(state, action.seatId, action.round, action.turnNo, [
        'running',
      ])
        ? turnOver(state, 'guessed')
        : state;
    case 'crocTimeUp':
      return state.phase === 'running' && action.turnNo === state.turnNo
        ? turnOver(state, 'timeUp')
        : state;
    case 'crocLeft':
      return (state.phase === 'ready' || state.phase === 'running') &&
        action.seatId === state.describerSeatId
        ? turnOver(state, 'cancelled', action.name)
        : state;
    case 'crocNext':
      return state.phase === 'result' ? toPick(state) : state;
    case 'crocEnd': {
      const { endsAt: _endsAt, result: _result, ...rest } = state;
      return { ...rest, phase: 'ended' };
    }
    case 'resumed':
      // The turn timer did not survive the restart: the same describer starts the same word again.
      if (state.phase === 'running') {
        const { endsAt: _endsAt, ...rest } = state;
        return { ...rest, phase: 'ready' };
      }
      return state.phase === 'result' ? toPick(state) : state;
    default:
      return state;
  }
}

/** Final score (AC7): finished games = wins + draws; a second End changes nothing. */
function xoEnded(state: XoState): XoState {
  if (state.ended) {
    return state;
  }
  const wins = Object.values(state.score).reduce((sum, n) => sum + n, 0);
  return {
    ...state,
    paused: false,
    ended: { games: wins + state.draws, draws: state.draws, score: state.score },
  };
}

/** A move counts only from the seat whose turn it is, on an empty cell of the current, running game (AC2, AC3). */
function xoMove(
  state: XoState,
  action: Extract<XoAction, { type: 'xoMove' }>,
): XoState {
  const mark =
    action.seatId === state.xSeatId
      ? 'x'
      : action.seatId === state.oSeatId
        ? 'o'
        : null;
  if (
    mark !== state.turn ||
    action.round !== state.round ||
    action.gameNo !== state.gameNo ||
    state.result !== null ||
    state.paused ||
    !Number.isInteger(action.cell) ||
    action.cell < 0 ||
    action.cell > 8 ||
    state.board[action.cell] !== null
  ) {
    return state;
  }
  const board = state.board.map((cell, index) =>
    index === action.cell ? mark : cell,
  );
  const turn = mark === 'x' ? 'o' : 'x';
  const win = findWin(board);
  if (win) {
    return {
      ...state,
      board,
      turn,
      result: { kind: 'win', mark: win.mark, line: win.line },
      score: {
        ...state.score,
        [action.seatId]: (state.score[action.seatId] ?? 0) + 1,
      },
    };
  }
  if (isFull(board)) {
    return { ...state, board, turn, result: { kind: 'draw' }, draws: state.draws + 1 };
  }
  return { ...state, board, turn };
}

/** X and O broadcast: the whole board state (nothing is secret). */
export function toXoPublic(state: XoState): XoPublic {
  return {
    board: state.board,
    xSeatId: state.xSeatId,
    oSeatId: state.oSeatId,
    turn: state.turn,
    result: state.result,
    score: state.score,
    draws: state.draws,
    gameNo: state.gameNo,
    paused: state.paused,
    ...(state.ended ? { ended: state.ended } : {}),
  };
}

/** Crocodile broadcast: never the packs; the word only once the turn is over (result). */
export function toCrocPublic(
  state: CrocState,
  now: number = Date.now(),
): CrocPublic {
  const shows =
    state.phase === 'ready' ||
    state.phase === 'running' ||
    state.phase === 'result';
  return {
    phase: state.phase,
    turnNo: state.turnNo,
    durationSec: state.durationSec,
    totals: state.totals,
    ...(shows && state.describerSeatId
      ? { describerSeatId: state.describerSeatId }
      : {}),
    ...(state.phase === 'running' && state.endsAt !== undefined
      ? { remainingMs: Math.max(0, Math.round(state.endsAt - now)) }
      : {}),
    ...(state.phase === 'result' && state.result
      ? { result: state.result }
      : {}),
  };
}

/** The word card, for the describer's seat only. */
export function crocSecretFor(
  state: CrocState,
  seatId: string | null,
): CrocSecret | null {
  if (
    (state.phase !== 'ready' && state.phase !== 'running') ||
    !seatId ||
    seatId !== state.describerSeatId ||
    !state.word
  ) {
    return null;
  }
  return { word: state.word.id, pack: state.word.pack, turnNo: state.turnNo };
}

/** Mafia broadcast: phase, ready and out (with roles only when the host reveals them). */
export function toMafiaPublic(state: MafiaState): MafiaPublic {
  return {
    phase: state.phase,
    readyCount: state.ready.length,
    playerCount: state.players.length,
    out: state.out.map(entry => {
      const roleId = state.deals[entry.seatId]?.roleId;
      return state.revealOut && roleId ? { ...entry, roleId } : entry;
    }),
    revealOut: state.revealOut,
    ...(state.ended
      ? {
          ended: {
            winner: state.ended.winner,
            roles: dealtRoles(state.players, state.deals),
          },
        }
      : {}),
  };
}

/** The broadcast part of the state: everything except the deals. */
export function toPublic(state: GameState): PublicGame {
  const base = {
    packId: state.settings.packId,
    players: state.players,
    waiting: state.waiting,
  };
  switch (state.game) {
    case 'imposter':
      return {
        ...base,
        imposters: state.imposterSeats.length,
        showCategory: state.settings.showCategory,
        order: state.order ?? state.players,
        ...(state.phase === 'revealed'
          ? {
              imposterSeatIds: state.imposterSeats,
              ...(state.wordId ? { wordId: state.wordId } : {}),
            }
          : {}),
      };
    case 'whoami':
      return base;
    case 'rather': {
      const picks = Object.values(state.votes);
      return {
        ...base,
        questionId: state.questions[state.qIndex],
        qIndex: state.qIndex,
        total: state.questions.length,
        voted: Object.keys(state.votes),
        ...(state.phase === 'revealed'
          ? {
              tally: {
                a: picks.filter(pick => pick === 'a').length,
                b: picks.filter(pick => pick === 'b').length,
              },
              picks: state.votes,
            }
          : {}),
      };
    }
  }
}
