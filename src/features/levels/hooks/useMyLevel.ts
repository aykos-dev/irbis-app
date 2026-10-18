import { useEffect } from 'react';

import { useMeLevelGet } from '../../../shared/api/generated';
import type { MyLevelDto } from '../../../shared/api/generated/model';
import { useAuth } from '../../../shared/contexts/auth';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { storage } from '../../../shared/storage';
import { qaLog } from '../../../shared/utils/qaLog';

type SavedLevel = { userId: string; data: MyLevelDto };

function isSavedLevel(value: unknown): value is SavedLevel {
  if (typeof value !== 'object' || value === null || !('userId' in value) || !('data' in value)) {
    return false;
  }
  const { userId, data } = value;
  return (
    typeof userId === 'string' &&
    typeof data === 'object' &&
    data !== null &&
    'level' in data &&
    typeof data.level === 'number'
  );
}

/** The saved level of this user only; another account's or an unreadable value counts as none. */
function savedLevel(userId: string | undefined): MyLevelDto | undefined {
  const raw = storage.getString('levels.lastMyLevel');
  if (raw === undefined || userId === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isSavedLevel(parsed)) {
      return parsed.userId === userId ? parsed.data : undefined;
    }
  } catch {
    // Unreadable JSON is handled like a wrong shape below.
  }
  storage.remove('levels.lastMyLevel');
  qaLog('levels_saved_invalid', { key: 'levels.lastMyLevel' });
  return undefined;
}

/**
 * The signed-in user's level (`GET /v1/me/level`, AC5). Guests never call it. Offline it falls
 * back to the last level saved for the same user (MMKV `levels.lastMyLevel`). Never optimistic.
 */
export function useMyLevel() {
  const { status, user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const userId = user?.id;
  const query = useMeLevelGet({
    query: {
      enabled: status === 'signedIn',
      // The app shell's level-up queue loads the level at start. Online, a screen opened after
      // that load failed shows the error with Try again; offline it refetches (paused) and shows
      // the saved level or the offline state.
      retryOnMount: !isOnline,
      placeholderData: isOnline ? undefined : () => savedLevel(userId),
    },
  });
  const { data, isPlaceholderData } = query;

  useEffect(() => {
    if (data && !isPlaceholderData && userId !== undefined) {
      const saved: SavedLevel = { userId, data };
      storage.setString('levels.lastMyLevel', JSON.stringify(saved));
    }
  }, [data, isPlaceholderData, userId]);

  return query;
}
