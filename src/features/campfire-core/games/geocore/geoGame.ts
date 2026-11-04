import { z } from 'zod';

import {
  GEO_ROUNDS,
  geoModeSchema,
  geoPhaseSchema,
  geoPointSchema,
  geoRevealSchema,
  type GeoPoint,
  type GeoPublic,
  type GeoReveal,
} from '../../protocol/codec';
import { cities, countries } from './geoData';
import { scoreGuess, type GeoMode } from './scoring';

/** Players per Geocore game, host included: solo works (spec AC2). */
export const geoRange = { min: 1, max: 15 } as const;
/** Answer time per round and how long the reveal shows before the next round. */
export const GEO_QUESTION_MS = 20_000;
export const GEO_REVEAL_MS = 8_000;

// The wire enum and the scoring type name the same four modes.
const modeCheck: Record<GeoMode, z.infer<typeof geoModeSchema>> = {
  findCountry: 'findCountry',
  capitalToCountry: 'capitalToCountry',
  countryToCapital: 'countryToCapital',
  cityDistance: 'cityDistance',
};
export const geoModeList = Object.values(modeCheck);

/** Geocore host state (saved with the room for resume). Guesses never leave the host before the reveal. */
export const geoStateSchema = z.object({
  game: z.literal('geo'),
  mode: geoModeSchema,
  round: z.number().int().min(1),
  roundNo: z.number().int().min(1).max(GEO_ROUNDS),
  of: z.number().int().min(1),
  promptIds: z.array(z.string().min(1)).length(GEO_ROUNDS),
  phase: geoPhaseSchema,
  /** Question: when the round closes, on the host's clock (ms). */
  endsAt: z.number().optional(),
  /** Reveal: when the next round starts. */
  revealEndsAt: z.number().optional(),
  /** Dealt in at start / play again; a mid-game joiner waits for the next game. */
  seats: z.array(z.string().min(1)),
  guesses: z.record(z.string(), geoPointSchema),
  lastReveal: geoRevealSchema.optional(),
  totals: z.record(z.string(), z.number().int().min(0)),
});
export type GeoState = z.infer<typeof geoStateSchema>;

export type GeoAction =
  /** `seats`: the connected seats (host included); `promptIds` from `drawPrompts(mode)` on the host. */
  | {
      type: 'startGeo';
      mode: GeoMode;
      seats: string[];
      now: number;
      promptIds: string[];
    }
  /** `connected`: seats connected now; once every connected dealt seat answered, the round closes. */
  | {
      type: 'geoGuess';
      seatId: string;
      round: number;
      roundNo: number;
      lat: number;
      lng: number;
      iso?: string;
      now: number;
      connected: string[];
    }
  /** The host's question timer ran out for round `roundNo`. */
  | { type: 'geoTimeUp'; roundNo: number; now: number }
  /** The host's Next tap or the reveal timer: the next question, or the final after round 10. */
  | { type: 'geoNext'; roundNo: number; now: number }
  | { type: 'geoPlayAgain'; now: number; promptIds: string[]; seats: string[] };

const zeroTotals = (seats: string[]) =>
  Object.fromEntries(seats.map(seatId => [seatId, 0]));

export function startGeo(
  mode: GeoMode,
  seats: string[],
  now: number,
  promptIds: string[],
  round = 1,
): GeoState | null {
  if (
    seats.length < geoRange.min ||
    seats.length > geoRange.max ||
    promptIds.length !== GEO_ROUNDS
  ) {
    return null;
  }
  return {
    game: 'geo',
    mode,
    round,
    roundNo: 1,
    of: GEO_ROUNDS,
    promptIds,
    phase: 'question',
    endsAt: now + GEO_QUESTION_MS,
    seats,
    guesses: {},
    totals: zeroTotals(seats),
  };
}

/** Where the answer is: the country, its capital or the city (iso only for the country modes). */
export function geoAnswer(mode: GeoMode, promptId: string): GeoPoint | null {
  if (mode === 'cityDistance') {
    const city = cities.find(item => item.id === promptId);
    return city ? { lat: city.lat, lng: city.lng } : null;
  }
  const country = countries.find(item => item.id === promptId);
  if (!country) {
    return null;
  }
  return mode === 'countryToCapital'
    ? { iso: country.iso, lat: country.capital.lat, lng: country.capital.lng }
    : { iso: country.iso, lat: country.lat, lng: country.lng };
}

/** Closes the question: scores every dealt seat (no answer = 0) and shows the reveal. */
function closeRound(state: GeoState, now: number): GeoState {
  const promptId = state.promptIds[state.roundNo - 1] ?? '';
  const answer = geoAnswer(state.mode, promptId) ?? { lat: 0, lng: 0 };
  const totals = { ...state.totals };
  const results: GeoReveal['results'] = state.seats.map(seatId => {
    const guess = state.guesses[seatId];
    const { km, points } = scoreGuess(state.mode, promptId, guess ?? null);
    totals[seatId] = (totals[seatId] ?? 0) + points;
    return guess
      ? { seatId, ...guess, km, points }
      : { seatId, km: null, points: 0 };
  });
  const { endsAt: _endsAt, ...rest } = state;
  return {
    ...rest,
    phase: 'reveal',
    revealEndsAt: now + GEO_REVEAL_MS,
    lastReveal: { roundNo: state.roundNo, answer, results },
    totals,
  };
}

/** Geocore: question (20 s) → reveal (8 s) → … ×10 → final; Play again starts over. */
export function geoReducer(state: GeoState, action: GeoAction): GeoState {
  switch (action.type) {
    case 'geoGuess': {
      if (
        state.phase !== 'question' ||
        action.round !== state.round ||
        action.roundNo !== state.roundNo ||
        !state.seats.includes(action.seatId) ||
        state.guesses[action.seatId] ||
        (state.endsAt !== undefined && action.now > state.endsAt)
      ) {
        return state;
      }
      const guess: GeoPoint = {
        lat: action.lat,
        lng: action.lng,
        ...(action.iso ? { iso: action.iso } : {}),
      };
      const next = {
        ...state,
        guesses: { ...state.guesses, [action.seatId]: guess },
      };
      const allIn = next.seats
        .filter(seatId => action.connected.includes(seatId))
        .every(seatId => next.guesses[seatId]);
      return allIn ? closeRound(next, action.now) : next;
    }
    case 'geoTimeUp':
      return state.phase === 'question' && action.roundNo === state.roundNo
        ? closeRound(state, action.now)
        : state;
    case 'geoNext': {
      if (state.phase !== 'reveal' || action.roundNo !== state.roundNo) {
        return state;
      }
      const { revealEndsAt: _reveal, ...rest } = state;
      if (state.roundNo >= state.of) {
        return { ...rest, phase: 'final' };
      }
      return {
        ...rest,
        phase: 'question',
        roundNo: state.roundNo + 1,
        endsAt: action.now + GEO_QUESTION_MS,
        guesses: {},
      };
    }
    case 'geoPlayAgain':
      if (state.phase !== 'final') {
        return state;
      }
      return (
        startGeo(
          state.mode,
          action.seats,
          action.now,
          action.promptIds,
          state.round + 1,
        ) ?? state
      );
    default:
      return state;
  }
}

/** Geocore broadcast: who answered, never what, until the round is revealed. */
export function toGeoPublic(state: GeoState, now: number = Date.now()): GeoPublic {
  const deadline =
    state.phase === 'question'
      ? state.endsAt
      : state.phase === 'reveal'
        ? state.revealEndsAt
        : undefined;
  return {
    mode: state.mode,
    roundNo: state.roundNo,
    of: state.of,
    phase: state.phase,
    promptId: state.promptIds[state.roundNo - 1] ?? '',
    ...(deadline !== undefined
      ? { endsAt: deadline, remainingMs: Math.max(0, Math.round(deadline - now)) }
      : {}),
    answered: state.seats.filter(seatId => state.guesses[seatId]),
    totals: state.totals,
    reveal: state.phase === 'question' ? null : state.lastReveal ?? null,
  };
}

/** Final places: by total, highest first; equal totals share a place and the next place skips (1, 2, 3, 3, 5). */
export function geoRanks(
  totals: Record<string, number>,
): { seatId: string; total: number; place: number }[] {
  const sorted = Object.entries(totals)
    .map(([seatId, total]) => ({ seatId, total }))
    .sort((a, b) => b.total - a.total);
  return sorted.map(entry => ({
    ...entry,
    place: sorted.findIndex(other => other.total === entry.total) + 1,
  }));
}
