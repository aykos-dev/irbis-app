import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { useLevelUpQueue } from '../features/levels/hooks/useLevelUpQueue';
import type { PendingLevelUpDto } from '../shared/api/generated/model';
import { useAuth } from '../shared/contexts/auth';
import { navigationRef } from './navigation/navigationRef';

/** Place queries carry `viewer` (level, qualifies), so they change with the session. */
function isPlaceQuery(queryKey: readonly unknown[]): boolean {
  const [head] = queryKey;
  return typeof head === 'string' && head.startsWith('/v1/places');
}

/**
 * Session-level levels wiring above the navigator (levels AC7, AC8): the level-up queue that opens
 * LevelUp for pending level-ups, and a refresh of place queries on sign-in so a place opened as a
 * guest shows the account's `viewer` level.
 */
export function LevelUpHost() {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const previousStatus = useRef(status);

  useEffect(() => {
    const was = previousStatus.current;
    previousStatus.current = status;
    if (status === 'signedIn' && was === 'guest') {
      void queryClient.invalidateQueries({ predicate: query => isPlaceQuery(query.queryKey) });
    }
  }, [status, queryClient]);

  const open = useCallback((levelUp: PendingLevelUpDto) => {
    if (!navigationRef.isReady()) {
      return false;
    }
    navigationRef.navigate('LevelUp', {
      id: levelUp.id,
      fromLevel: levelUp.fromLevel,
      toLevel: levelUp.toLevel,
      maxDifficulty: levelUp.maxDifficulty,
      newPlacesCount: levelUp.newPlacesCount,
    });
    return true;
  }, []);
  const isOpen = useCallback(() => navigationRef.getCurrentRoute()?.name === 'LevelUp', []);

  useLevelUpQueue({ open, isOpen });
  return null;
}
