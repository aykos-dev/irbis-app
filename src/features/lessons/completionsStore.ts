import type { CompletionAttempt } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';

/** A first completion made on this device (AC7); `synced` turns true once the server has it. */
export type LocalCompletion = {
  lessonId: string;
  completedAt: string;
  attempts: CompletionAttempt[];
  perfect: boolean;
  synced: boolean;
};

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

/** First lesson completions on this device (MMKV `lessons.completions`); sent by lessons slice 4. */
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
    storage.setString('lessons.completions', JSON.stringify([...current, completion]));
  },
};
