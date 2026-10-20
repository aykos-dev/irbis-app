import { z } from 'zod';

import { roleIds } from '../games/mafia/roles';
import { animals } from '../playerProfile';

/**
 * Local Campfire protocol (spec § Local protocol): newline-delimited JSON over TCP, `v: 5`
 * (v2 added the party games: `deal`, `game`, `lobby`, `wyrVote`, `showMine`; v3 adds Mafia:
 * its `deal` / `game` shapes and `mafReady`; v5 adds Crocodile: its `deal` / `game` shapes and
 * `crocStart`, `crocSkip`, `crocGuessed`).
 */
export const PROTOCOL_VERSION = 5;
export const CAMP_PORT = 47821;
export const MAX_SEATS = 15;
/** Clients ping this often; the host answers `pong`. */
export const PING_INTERVAL_MS = 3000;
/** No traffic for this long = disconnected (seat kept, status `reconnecting`). */
export const SILENCE_TIMEOUT_MS = 10000;

const version = z.literal(PROTOCOL_VERSION);
const nickname = z.string().trim().min(1).max(32);

export const seatStatusSchema = z.enum(['connected', 'reconnecting']);
export type SeatStatus = z.infer<typeof seatStatusSchema>;

export const rosterPlayerSchema = z.object({
  seatId: z.string().min(1),
  nickname,
  avatar: z.enum(animals),
  host: z.boolean(),
  status: seatStatusSchema,
});
export type RosterPlayer = z.infer<typeof rosterPlayerSchema>;

export const helloSchema = z.object({
  v: version,
  type: z.literal('hello'),
  code: z.string().regex(/^\d{4}$/),
  nickname,
  avatar: z.enum(animals),
  seatToken: z.string().min(1).optional(),
});
export type Hello = z.infer<typeof helloSchema>;

const roomCode = z.string().regex(/^\d{4}$/);
const seatId = z.string().min(1);
const round = z.number().int().min(1);

export const partyGameSchema = z.enum(['imposter', 'whoami', 'rather']);
export const wyrPickSchema = z.enum(['a', 'b']);
export type WyrPick = z.infer<typeof wyrPickSchema>;

/** One seat's Imposter card: the word, or "you're the imposter" (with the category if allowed). */
export const imposterSecretSchema = z.object({
  role: z.enum(['word', 'imposter']),
  wordId: z.string().min(1).optional(),
  packId: z.string().min(1),
  showCategory: z.boolean(),
});
export type ImposterSecret = z.infer<typeof imposterSecretSchema>;
/** Who am I: everyone's character except your own; `mine` once you asked to see it (`showMine`). */
export const whoamiSecretSchema = z.object({
  others: z.array(z.object({ seatId, characterId: z.string().min(1) })),
  mine: z.string().min(1).optional(),
});
export type WhoamiSecret = z.infer<typeof whoamiSecretSchema>;
export const secretSchema = z.union([imposterSecretSchema, whoamiSecretSchema]);
export type Secret = z.infer<typeof secretSchema>;

/** Mafia: one seat's role (host gets none; it narrates). */
export const mafiaRoleIdSchema = z.enum(roleIds);
export const mafiaSecretSchema = z.object({ roleId: mafiaRoleIdSchema });
export type MafiaSecret = z.infer<typeof mafiaSecretSchema>;

export const gamePhaseSchema = z.enum(['dealt', 'voting', 'revealed']);
export type GamePhase = z.infer<typeof gamePhaseSchema>;

/** What every phone may see about the round. Never a word or character id from a deal. */
export const publicGameSchema = z.object({
  packId: z.string().min(1),
  players: z.array(seatId),
  /** Joined mid-round: they play from the next round. */
  waiting: z.array(seatId),
  imposters: z.number().int().min(1).max(2).optional(),
  showCategory: z.boolean().optional(),
  /** Imposter: clue order for the round, fixed by the host. */
  order: z.array(seatId).optional(),
  /** Imposter, after the reveal only. */
  imposterSeatIds: z.array(seatId).optional(),
  wordId: z.string().min(1).optional(),
  questionId: z.string().min(1).optional(),
  qIndex: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
  voted: z.array(seatId).optional(),
  tally: z
    .object({ a: z.number().int().min(0), b: z.number().int().min(0) })
    .optional(),
  /** Would you rather, after the reveal only: who picked what. */
  picks: z.record(seatId, wyrPickSchema).optional(),
});
export type PublicGame = z.infer<typeof publicGameSchema>;

/** Mafia: night or day number `n` (night 1 first). */
export const mafiaPhaseSchema = z.object({
  kind: z.enum(['night', 'day']),
  n: z.number().int().min(1),
});
export type MafiaPhase = z.infer<typeof mafiaPhaseSchema>;

/** A seat out of the Mafia game; `roleId` only when "Reveal role when out" is on. */
export const mafiaOutSchema = z.object({
  seatId,
  reason: z.enum(['killed', 'exiled']),
  phase: mafiaPhaseSchema,
  roleId: mafiaRoleIdSchema.optional(),
});
export type MafiaOut = z.infer<typeof mafiaOutSchema>;

/** Who won a Mafia game; `none` when the host ended it without a winner. */
export const mafiaWinnerSchema = z.enum(['town', 'mafia', 'maniac', 'none']);
export type MafiaWinner = z.infer<typeof mafiaWinnerSchema>;

/** What every phone may see about the Mafia game. Never a role of a seat still in, until `ended`. */
export const mafiaPublicSchema = z.object({
  phase: mafiaPhaseSchema,
  readyCount: z.number().int().min(0),
  playerCount: z.number().int().min(0),
  out: z.array(mafiaOutSchema),
  revealOut: z.boolean(),
  /** Game over: the winner and every dealt seat's role (the only time players see others' roles). */
  ended: z
    .object({
      winner: mafiaWinnerSchema,
      roles: z.record(seatId, mafiaRoleIdSchema),
    })
    .optional(),
});
export type MafiaPublic = z.infer<typeof mafiaPublicSchema>;

/**
 * Crocodile: pick the describer → ready (describer holds the word) → running (the turn) → result
 * (~3 s) → pick; `ended` once the host ends the game.
 */
export const crocPhaseSchema = z.enum([
  'pick',
  'ready',
  'running',
  'result',
  'ended',
]);
export type CrocPhase = z.infer<typeof crocPhaseSchema>;

const turnNo = z.number().int().min(0);

/** The describer's card: word and pack ids (the phone shows them in its language), for turn `turnNo`. */
export const crocSecretSchema = z.object({
  word: z.string().min(1),
  pack: z.string().min(1),
  turnNo,
});
export type CrocSecret = z.infer<typeof crocSecretSchema>;

export const crocTotalsSchema = z.object({
  guessed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  turns: z.number().int().min(0),
});
export type CrocTotals = z.infer<typeof crocTotalsSchema>;

/** A Crocodile word: item id in pack `pack` (each phone shows it in its own language). */
export const crocWordSchema = z.object({
  id: z.string().min(1),
  pack: z.string().min(1),
});
export type CrocWord = z.infer<typeof crocWordSchema>;

/** How a turn ended; `name` = the describer who left (cancelled only). The word is public by now. */
export const crocResultSchema = z.object({
  kind: z.enum(['guessed', 'timeUp', 'cancelled']),
  word: crocWordSchema,
  name: z.string().optional(),
});
export type CrocResult = z.infer<typeof crocResultSchema>;

/** What every phone may see about the Crocodile game. Never the word while the turn runs. */
export const crocPublicSchema = z.object({
  phase: crocPhaseSchema,
  turnNo,
  durationSec: z.number().int().min(1),
  totals: crocTotalsSchema,
  /** Who shows this turn (ready / running / result only). */
  describerSeatId: seatId.optional(),
  /** Running only: turn time left when the host sent this (each phone counts down from it). */
  remainingMs: z.number().int().min(0).optional(),
  /** Result only. */
  result: crocResultSchema.optional(),
});
export type CrocPublic = z.infer<typeof crocPublicSchema>;

/** Host → one seat: that seat's secret for the round (no deal in Would you rather; none for the Mafia host). */
const dealMessageSchema = z.discriminatedUnion('game', [
  z.object({
    v: version,
    type: z.literal('deal'),
    game: partyGameSchema,
    round,
    secret: secretSchema,
  }),
  z.object({
    v: version,
    type: z.literal('deal'),
    game: z.literal('mafia'),
    round,
    secret: mafiaSecretSchema,
  }),
  z.object({
    v: version,
    type: z.literal('deal'),
    game: z.literal('croc'),
    round,
    secret: crocSecretSchema,
  }),
]);

/** Host → all: the public round state. */
const gameMessageSchema = z.discriminatedUnion('game', [
  z.object({
    v: version,
    type: z.literal('game'),
    game: partyGameSchema,
    round,
    phase: gamePhaseSchema,
    public: publicGameSchema,
  }),
  z.object({
    v: version,
    type: z.literal('game'),
    game: z.literal('mafia'),
    round,
    phase: mafiaPhaseSchema,
    public: mafiaPublicSchema,
  }),
  z.object({
    v: version,
    type: z.literal('game'),
    game: z.literal('croc'),
    round,
    phase: crocPhaseSchema,
    public: crocPublicSchema,
  }),
]);

export const clientMessageSchema = z.discriminatedUnion('type', [
  helloSchema,
  /** Discovery: "is room <code> here?" without taking a seat. */
  z.object({ v: version, type: z.literal('probe'), code: roomCode }),
  z.object({ v: version, type: z.literal('ping') }),
  z.object({ v: version, type: z.literal('leave') }),
  z.object({
    v: version,
    type: z.literal('wyrVote'),
    round,
    qIndex: z.number().int().min(0),
    pick: wyrPickSchema,
  }),
  z.object({ v: version, type: z.literal('showMine'), round }),
  /** Mafia: this seat has seen its role. */
  z.object({ v: version, type: z.literal('mafReady'), round }),
  /** Crocodile, describer only: start the turn, another word, or the word was guessed. */
  z.object({ v: version, type: z.literal('crocStart'), round, turnNo }),
  z.object({ v: version, type: z.literal('crocSkip'), round, turnNo }),
  z.object({ v: version, type: z.literal('crocGuessed'), round, turnNo }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const rejectReasonSchema = z.enum(['full', 'wrong_code', 'version']);
export type RejectReason = z.infer<typeof rejectReasonSchema>;

export const hostMessageSchema = z.discriminatedUnion('type', [
  z.object({
    v: version,
    type: z.literal('welcome'),
    seatId: z.string().min(1),
    seatToken: z.string().min(1),
    room: z.object({ code: z.string() }),
  }),
  z.object({
    v: version,
    type: z.literal('roster'),
    players: z.array(rosterPlayerSchema),
  }),
  z.object({
    v: version,
    type: z.literal('rejected'),
    reason: rejectReasonSchema,
  }),
  z.object({ v: version, type: z.literal('removed') }),
  z.object({ v: version, type: z.literal('closed') }),
  z.object({ v: version, type: z.literal('pong') }),
  /** Answer to a matching `probe`: seats taken and the network name the room is on. */
  z.object({
    v: version,
    type: z.literal('probeOk'),
    players: z.number().int().min(0),
    network: z.string(),
  }),
  dealMessageSchema,
  gameMessageSchema,
  /** Host → all: the game ended, back to the lobby. */
  z.object({ v: version, type: z.literal('lobby') }),
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

type Unversioned<T> = T extends unknown ? Omit<T, 'v'> : never;
export type OutgoingHostMessage = Unversioned<HostMessage>;
export type OutgoingClientMessage = Unversioned<ClientMessage>;

/** One NDJSON line (with the trailing newline) for a message, stamped with `PROTOCOL_VERSION`. */
export function encode(
  message: OutgoingHostMessage | OutgoingClientMessage,
): string {
  return `${JSON.stringify({ v: PROTOCOL_VERSION, ...message })}\n`;
}

export type Decoded<T> =
  { ok: true; message: T } | { ok: false; reason: 'invalid' | 'version' };

function decodeWith<T>(schema: z.ZodType<T>, line: string): Decoded<T> {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'v' in raw &&
    raw.v !== PROTOCOL_VERSION
  ) {
    return { ok: false, reason: 'version' };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, message: parsed.data }
    : { ok: false, reason: 'invalid' };
}

export const decodeClient = (line: string) =>
  decodeWith(clientMessageSchema, line);
export const decodeHost = (line: string) => decodeWith(hostMessageSchema, line);

/** Splits a TCP byte stream into complete lines; keeps the unfinished tail for the next chunk. */
export function createLineBuffer(): (chunk: string) => string[] {
  let tail = '';
  return chunk => {
    const parts = (tail + chunk).split('\n');
    tail = parts.pop() ?? '';
    return parts.map(part => part.trim()).filter(part => part.length > 0);
  };
}
