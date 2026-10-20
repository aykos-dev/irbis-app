import type { LessonCatalog } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';
import { completionsStore, type LocalCompletion } from './completionsStore';
import { tashkentDay } from './tashkentDay';

export type { LocalCompletion } from './completionsStore';

type Saved = { userId: string | null; day: string; data: LessonCatalog };

function isSaved(value: unknown): value is Saved {
  if (typeof value !== 'object' || value === null || !('data' in value) || !('day' in value)) {
    return false;
  }
  const { data, day } = value;
  return (
    typeof day === 'string' &&
    typeof data === 'object' &&
    data !== null &&
    'tiers' in data &&
    Array.isArray(data.tiers) &&
    'config' in data
  );
}

function read(): Saved | null {
  const raw = storage.getString('lessons.catalog');
  if (raw === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSaved(parsed)) {
      return parsed;
    }
  } catch {
    // Unreadable JSON is dropped like a wrong shape below.
  }
  storage.remove('lessons.catalog');
  qaLog('lessons_saved_invalid', { key: 'lessons.catalog' });
  return null;
}

/**
 * The last loaded catalog (MMKV `lessons.catalog`), saved on every successful fetch, for offline
 * opens. Progress belongs to one account: another user's snapshot is read without it, and
 * `doneToday` counts only on the day it was saved.
 */
export const catalogStore = {
  save(data: LessonCatalog, userId: string | null): void {
    const saved: Saved = { userId, day: tashkentDay(), data };
    storage.setString('lessons.catalog', JSON.stringify(saved));
  },

  snapshot(userId: string | null): LessonCatalog | undefined {
    const saved = read();
    if (!saved) {
      return undefined;
    }
    if (!saved.data.progress || saved.userId !== userId) {
      return { ...saved.data, progress: null };
    }
    if (saved.day !== tashkentDay()) {
      return { ...saved.data, progress: { ...saved.data.progress, doneToday: 0 } };
    }
    return saved.data;
  },

  /** Hearts per day from the last loaded catalog, if any. */
  heartsPerDay(): number | undefined {
    return read()?.data.config.heartsPerDay;
  },

  /** First completions made on this device (the quiz adds them, AC7). */
  localCompletions(): LocalCompletion[] {
    return completionsStore.all();
  },
};

