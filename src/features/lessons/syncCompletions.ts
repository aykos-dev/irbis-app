import type { QueryClient } from '@tanstack/react-query';

import { getLessonsListQueryKey, getMeLevelGetQueryKey, lessonsComplete } from '../../shared/api/generated';
import { isApiError } from '../../shared/api/errors';
import { qaLog } from '../../shared/utils/qaLog';
import { completionsStore } from './completionsStore';

/** The API refuses these for good (invalid run, unknown lesson): dropped, never retried. */
const DROP_STATUSES: readonly number[] = [400, 404];

let running: Promise<void> | null = null;
let again = false;

async function sendQueued(queryClient: QueryClient): Promise<void> {
  const queued = completionsStore.unsynced();
  if (queued.length === 0) {
    return;
  }
  let sent = 0;
  for (const completion of queued) {
    try {
      await lessonsComplete({
        lessonId: completion.lessonId,
        completedAt: completion.completedAt,
        attempts: completion.attempts,
      });
      completionsStore.markSynced([completion.lessonId]);
      sent += 1;
    } catch (error) {
      if (isApiError(error) && error.status !== null && DROP_STATUSES.includes(error.status)) {
        completionsStore.markSynced([completion.lessonId], { dropped: true });
        qaLog('lesson_sync_dropped', { code: error.code, requestId: error.requestId ?? null });
        continue;
      }
      // Offline, 5xx or 401: it stays queued and goes again on the next trigger, oldest first.
      qaLog('lesson_sync_failed', { code: isApiError(error) ? error.code : 'unknown' });
      break;
    }
  }
  if (sent > 0) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getLessonsListQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getMeLevelGetQueryKey() }),
    ]);
  }
  qaLog('lesson_sync', { sent, queued: completionsStore.unsynced().length });
}

/**
 * Sends every unsynced completion to `POST /v1/me/lesson-completions`, one at a time (AC7). Never
 * two flushes at once: a trigger during a flush runs one more pass right after it.
 */
export function syncCompletions(queryClient: QueryClient): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await sendQueued(queryClient);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}
