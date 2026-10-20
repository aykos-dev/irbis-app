import type { CompletionAttempt } from '../../shared/api/generated/model';
import { registerGuestItem } from '../../shared/guest/guestStore';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';

/** A first completion made on this device (AC7); `synced` turns true once the server has it. */
export type LocalCompletion = {
  lessonId: string;
  completedAt: string;
  attempts: CompletionAttempt[];
  perfect: boolean;
  synced: boolean;
  /** The server refused it for good (400 / 404): never sent again. */
  dropped?: boolean;
};

const listeners = new Set<() => void>();

function write(completions: LocalCompletion[]): void {
  storage.setString('lessons.completions', JSON.stringify(completions));
}

function isCompletion(value: unknown): value is LocalCompletion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    'lessonId' in value &&
    typeof value.lessonId === 'string' &&
    'completedAt' in value &&
    typeof value.completedAt === 'string' &&
    'attempts' in value &&
    Array.isArray(value.attempts)
  );
}

function read(): LocalCompletion[] {
  const raw = storage.getString('lessons.completions');
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(isCompletion)) {
      return parsed;
    }
  } catch {
    // Unreadable JSON is dropped like a wrong shape below.
  }
  storage.remove('lessons.completions');
  qaLog('lessons_saved_invalid', { key: 'lessons.completions' });
  return [];
}

/** First lesson completions on this device (MMKV `lessons.completions`); the sync sends the unsynced ones. */
export const completionsStore = {
  all(): LocalCompletion[] {
    return read();
  },

  /** Keeps the first completion of a lesson only. */
  add(completion: LocalCompletion): void {
    const current = read();
    if (current.some(entry => entry.lessonId === completion.lessonId)) {
      return;
    }
    write([...current, completion]);
    listeners.forEach(listener => listener());
  },

  /** Not yet on the server, oldest first. */
  unsynced(): LocalCompletion[] {
    return read()
      .filter(entry => !entry.synced)
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  },

  /** Marks these lessons as on the server (`dropped`: refused, never retried). */
  markSynced(lessonIds: string[], options: { dropped?: boolean } = {}): void {
    const ids = new Set(lessonIds);
    write(
      read().map(entry =>
        ids.has(entry.lessonId)
          ? { ...entry, synced: true, ...(options.dropped ? { dropped: true } : {}) }
          : entry,
      ),
    );
  },

  /** Called after every new completion. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The guest merge carries at most this many completions (API `@maxItems`), newest kept. */
export const GUEST_MERGE_MAX = 200;

/** Lessons the last collected guest merge carried; marked synced when that merge succeeds. */
let collectedIds: string[] = [];

registerGuestItem({
  id: 'lessons',
  collect: () => {
    const newest = completionsStore.unsynced().slice(-GUEST_MERGE_MAX);
    collectedIds = newest.map(entry => entry.lessonId);
    if (newest.length === 0) {
      return undefined;
    }
    return {
      lessons: {
        completions: newest.map(({ lessonId, completedAt, attempts }) => ({ lessonId, completedAt, attempts })),
      },
    };
  },
  onMerged: () => {
    if (collectedIds.length > 0) {
      completionsStore.markSynced(collectedIds);
    }
    collectedIds = [];
  },
});
