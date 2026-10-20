import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';
import { catalogStore } from './catalogStore';
import { msUntilTashkentMidnight, tashkentDay } from './tashkentDay';

export { tashkentDay } from './tashkentDay';

/** Hearts per day before any catalog was loaded (spec default). */
const DEFAULT_HEARTS_PER_DAY = 5;

type SavedHearts = { day: string; hearts: number };

function isSavedHearts(value: unknown): value is SavedHearts {
  if (typeof value !== 'object' || value === null || !('day' in value) || !('hearts' in value)) {
    return false;
  }
  return typeof value.day === 'string' && typeof value.hearts === 'number' && value.hearts >= 0;
}

function readSaved(): SavedHearts | undefined {
  const raw = storage.getString('lessons.hearts');
  if (raw === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSavedHearts(parsed)) {
      return parsed;
    }
  } catch {
    // An unreadable value counts as a new day below.
  }
  qaLog('lessons_saved_invalid', { key: 'lessons.hearts' });
  return undefined;
}

const listeners = new Set<() => void>();

/** Saves today's count; `notify` is off for the refill inside a read (readers already get it). */
function write(hearts: number, notify = true): number {
  const saved: SavedHearts = { day: tashkentDay(), hearts };
  storage.setString('lessons.hearts', JSON.stringify(saved));
  if (notify) {
    listeners.forEach(listener => listener());
  }
  return hearts;
}

/**
 * Daily hearts (AC6), one store for guests and accounts, kept on sign-out (MMKV `lessons.hearts`).
 * The first read on a new Tashkent day refills to the catalog's `heartsPerDay`.
 */
export const heartsStore = {
  hearts(): number {
    const saved = readSaved();
    if (saved && saved.day === tashkentDay()) {
      return saved.hearts;
    }
    const hearts = catalogStore.heartsPerDay() ?? DEFAULT_HEARTS_PER_DAY;
    qaLog('hearts_reset', { hearts });
    return write(hearts, false);
  },

  /** One heart less (never below 0); returns what is left. */
  loseHeart(): number {
    return write(Math.max(0, heartsStore.hearts() - 1));
  },

  /** Debug link only (`irbis://debug/lessons/hearts/<n>`). */
  setHearts(hearts: number): void {
    write(Math.max(0, hearts));
  },

  msUntilReset(): number {
    return msUntilTashkentMidnight();
  },

  /** Called after every change; returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
