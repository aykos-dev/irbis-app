import { useEffect, useState } from 'react';

import { useLessonsGet } from '../../../shared/api/generated';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { lessonCache } from '../lessonCache';

/**
 * One lesson with its questions (`GET /v1/lessons/{id}`, AC5). Every load is cached by id; offline
 * or on an error the cached copy is used, so a lesson opened once can be replayed offline.
 */
export function useLesson(lessonId: string) {
  const { isOnline } = useNetworkStatus();
  const query = useLessonsGet(lessonId);
  const [cached] = useState(() => lessonCache.get(lessonId));
  const { data } = query;

  useEffect(() => {
    if (data) {
      lessonCache.save(data);
    }
  }, [data]);

  const fallback = query.error || !isOnline ? cached : undefined;
  return { lesson: data ?? fallback, query };
}
