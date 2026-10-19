import { z } from 'zod';

import { storage } from '../../../shared/storage';
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
});

/** Saved after every room change; live connections are not saved. */
export function saveHostRoom(room: RoomState, now: number = Date.now()): void {
  const seats = room.seats.map(({ connId: _connId, ...seat }) => seat);
  storage.setString(
    'camp.hostRoom',
    JSON.stringify({
      savedAt: now,
      room: { code: room.code, nextSeat: room.nextSeat, seats },
    }),
  );
}

/** The saved room when it is younger than 12 h; an expired or unreadable entry is dropped. */
export function loadHostRoom(now: number = Date.now()): RoomState | null {
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
  const { room } = result.data;
  return {
    ...room,
    closed: false,
    seats: room.seats.map(seat => ({ ...seat, connId: null })),
  };
}

export function clearHostRoom(): void {
  storage.remove('camp.hostRoom');
}
