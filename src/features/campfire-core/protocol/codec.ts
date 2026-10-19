import { z } from 'zod';

import { animals } from '../playerProfile';

/** Local Campfire protocol (spec § Local protocol): newline-delimited JSON over TCP, `v: 1`. */
export const PROTOCOL_VERSION = 1;
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

export const clientMessageSchema = z.discriminatedUnion('type', [
  helloSchema,
  z.object({ v: version, type: z.literal('ping') }),
  z.object({ v: version, type: z.literal('leave') }),
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
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

type Unversioned<T> = T extends unknown ? Omit<T, 'v'> : never;
export type OutgoingHostMessage = Unversioned<HostMessage>;
export type OutgoingClientMessage = Unversioned<ClientMessage>;

/** One NDJSON line (with the trailing newline) for a message, stamped `v: 1`. */
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
