import { useEffect } from 'react';

import { useLessonsList } from '../../../shared/api/generated';
import { useAuth } from '../../../shared/contexts/auth';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { catalogStore } from '../catalogStore';

/**
 * The lesson catalog (`GET /v1/lessons`, AC4). Every successful load is saved; offline it falls
 * back to that snapshot (progress only when it belongs to the same account).
 */
export function useLessonsCatalog() {
  const { status, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;
  const query = useLessonsList({
    query: {
      enabled: status !== 'loading',
      placeholderData: isOnline ? undefined : () => catalogStore.snapshot(userId),
    },
  });
  const { data, isPlaceholderData } = query;

  useEffect(() => {
    // A signed-in snapshot waits for the account id, so its progress is never saved as a guest's.
    if (data && !isPlaceholderData && (status !== 'signedIn' || userId !== null)) {
      catalogStore.save(data, userId);
    }
  }, [data, isPlaceholderData, status, userId]);

  return query;
}
