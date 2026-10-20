import { z } from 'zod';

import { storage } from '../../../shared/storage';
import { qaLog } from '../../../shared/utils/qaLog';
import type { Pack, PackGame } from './packs';

/** Random number in [0, 1); injected so tests can pin the shuffle. */
export type Rng = () => number;

const usedSchema = z.array(z.string());

const usedKey = (game: PackGame, packId: string) =>
  `camp.used.${game}.${packId}` as const;

export function readUsed(game: PackGame, packId: string): string[] {
  const raw = storage.getString(usedKey(game, packId));
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const result = usedSchema.safeParse(parsed);
  return result.success ? result.data : [];
}

/** Fisher–Yates on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/**
 * Draws `count` item ids nobody has been dealt from this pack on this phone (AC8) and marks them
 * used. Not enough left → the pack starts over (`camp_pack_reshuffled`).
 */
export function drawIds(
  game: PackGame,
  pack: Pack,
  count: number,
  rng: Rng,
): string[] {
  const all = pack.items.map(item => item.id);
  let used = new Set(readUsed(game, pack.id));
  let free = all.filter(itemId => !used.has(itemId));
  if (free.length < count) {
    used = new Set();
    free = all;
    qaLog('camp_pack_reshuffled', { game, pack: pack.id });
  }
  const picked = shuffle(free, rng).slice(0, count);
  storage.setString(
    usedKey(game, pack.id),
    JSON.stringify([...used, ...picked]),
  );
  return picked;
}
