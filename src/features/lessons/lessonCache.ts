import type { PublicLesson } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';

type Cache = Record<string, PublicLesson>;

function isCache(value: unknown): value is Cache {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    lesson => typeof lesson === 'object' && lesson !== null && 'questions' in lesson && Array.isArray(lesson.questions),
  );
}

function read(): Cache {
  const raw = storage.getString('lessons.cache');
  if (raw === undefined) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isCache(parsed)) {
      return parsed;
    }
  } catch {
    // Unreadable JSON is dropped like a wrong shape below.
  }
  storage.remove('lessons.cache');
  qaLog('lessons_saved_invalid', { key: 'lessons.cache' });
  return {};
}

/** Every lesson loaded online (MMKV `lessons.cache`, by id), so it opens offline (AC5). */
export const lessonCache = {
  get(lessonId: string): PublicLesson | undefined {
    return read()[lessonId];
  },

  save(lesson: PublicLesson): void {
    storage.setString('lessons.cache', JSON.stringify({ ...read(), [lesson.id]: lesson }));
  },
};
