import { z } from 'zod';

import { storage } from '../../../shared/storage';
import { hostGameSchema, type HostGame } from '../games/gameReducer';
import { animals } from '../playerProfile';
import { seatStatusSchema } from '../protocol/codec';
import type { RoomState } from './roomReducer';

/** A saved room can be resumed for this long. */
export const RESUME_WINDOW_MS = 12 * 60 * 60 * 1000;

const savedSchema = z.object({
  savedAt: z.number(),
  room: z.object({
    code: z.string().regex(/^\d{4}$/),
    nextSeat: z.number().int().min(1),
    seats: z
      .array(
        z.object({
          seatId: z.string().min(1),
          seatToken: z.string(),
          nickname: z.string(),
          avatar: z.enum(animals),
          host: z.boolean(),
          status: seatStatusSchema,
        }),
      )
      .min(1),
  }),
  /** The running party game (round, deals) so a resumed room picks it up; absent in the lobby. */
  game: hostGameSchema.nullable().optional(),
});

/** Saved after every room or game change; live connections are not saved. */
export function saveHostRoom(
  room: RoomState,
  now: number = Date.now(),
  game: HostGame | null = null,
): void {
  const seats = room.seats.map(({ connId: _connId, ...seat }) => seat);
  storage.setString(
    'camp.hostRoom',
    JSON.stringify({
      savedAt: now,
      room: { code: room.code, nextSeat: room.nextSeat, seats },
      game,
    }),
  );
}

/** The saved room when it is younger than 12 h; an expired or unreadable entry is dropped. */
export function loadHostRoom(now: number = Date.now()): RoomState | null {
  return loadSaved(now)?.room ?? null;
}

/** The game running in the saved room, if any (same 12 h window as the room). */
export function loadHostGame(now: number = Date.now()): HostGame | null {
  return loadSaved(now)?.game ?? null;
}

function loadSaved(
  now: number,
): { room: RoomState; game: HostGame | null } | null {
  const raw = storage.getString('camp.hostRoom');
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const result = savedSchema.safeParse(parsed);
  if (
    !result.success ||
    now - result.data.savedAt >= RESUME_WINDOW_MS ||
    now < result.data.savedAt
  ) {
    clearHostRoom();
    return null;
  }
  const { room, game } = result.data;
  return {
    room: {
      ...room,
      closed: false,
      seats: room.seats.map(seat => ({ ...seat, connId: null })),
    },
    game: game ?? null,
  };
}

export function clearHostRoom(): void {
  storage.remove('camp.hostRoom');
}
