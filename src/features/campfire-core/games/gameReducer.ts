import { z } from 'zod';

import {
  gamePhaseSchema,
  mafiaOutSchema,
  mafiaPhaseSchema,
  mafiaSecretSchema,
  partyGameSchema,
  secretSchema,
  wyrPickSchema,
  type MafiaPublic,
  type MafiaSecret,
  type PublicGame,
  type Secret,
  type WyrPick,
} from '../protocol/codec';
import {
  dealBlocked,
  dealRoles,
  mafiaCountsSchema,
  type MafiaSettings,
} from './mafia/roles';
import type { PartyGame } from './packs';
import { shuffle, type Rng } from './usedStore';

/** Players per game, host included (spec AC1). */
export const playerRange: Record<PartyGame, { min: number; max: number }> = {
  imposter: { min: 3, max: 15 },
  whoami: { min: 3, max: 12 },
  rather: { min: 2, max: 15 },
};

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
});
export type MafiaState = z.infer<typeof mafiaStateSchema>;

/** The host's running game, party or Mafia (saved with the room for resume). */
export const hostGameSchema = z.discriminatedUnion('game', [
  gameStateSchema,
  mafiaStateSchema,
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
  | { type: 'end' }
  | { type: 'seatJoined'; seatId: string }
  | { type: 'seatRemoved'; seatId: string }
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
  | { type: 'mafMarkBack'; seatId: string };

export type HostAction = GameAction | MafiaAction;

/** Players in a round: the seats connected when it starts, host included. */
export function roundSeats(seats: GameSeat[]): string[] {
  return seats.filter(seat => seat.connected).map(seat => seat.seatId);
}

export function inRange(game: PartyGame, players: number): boolean {
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
  if (!state) {
    return state;
  }
  if (state.game === 'mafia') {
    return mafiaReducer(state, action);
  }
  switch (action.type) {
    case 'mafReady':
    case 'mafPhaseNext':
    case 'mafMarkOut':
    case 'mafMarkBack':
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
    round: 1,
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
  switch (action.type) {
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
          { seatId: action.seatId, reason: 'exiled', phase: state.phase },
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
