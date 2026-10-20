import { storage } from '../../shared/storage';

const KEY = 'path.swapDismissed';

type Dismissed = { month: string; keys: string[] };

function isDismissed(value: unknown): value is Dismissed {
  return (
    typeof value === 'object' &&
    value !== null &&
    'month' in value &&
    typeof value.month === 'string' &&
    'keys' in value &&
    Array.isArray(value.keys) &&
    value.keys.every(key => typeof key === 'string')
  );
}

/** The saved entry for `month`; another month's (or an unreadable) entry counts as empty. */
function read(month: string): string[] {
  const raw = storage.getString(KEY);
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isDismissed(parsed) && parsed.month === month) {
      return parsed.keys;
    }
  } catch {
    // Unreadable JSON is replaced on the next write, like an old month.
  }
  return [];
}

/**
 * Smart swaps hidden with "Keep plan" (AC3), MMKV `{month}:{position}`. A new Tashkent month
 * starts empty: the first write for it drops the old month's keys.
 */
export const swapDismissStore = {
  has(month: string, position: number): boolean {
    return read(month).includes(`${month}:${position}`);
  },

  add(month: string, position: number): void {
    const key = `${month}:${position}`;
    const keys = read(month);
    if (!keys.includes(key)) {
      storage.setString(KEY, JSON.stringify({ month, keys: [...keys, key] }));
    }
  },
};
