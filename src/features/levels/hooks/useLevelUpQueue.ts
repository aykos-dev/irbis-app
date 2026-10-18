import { useEffect, useRef } from 'react';

import { useMeLevelMarkLevelUpSeen } from '../../../shared/api/generated';
import type { PendingLevelUpDto } from '../../../shared/api/generated/model';
import { isApiError } from '../../../shared/api/errors';
import { useAuth } from '../../../shared/contexts/auth';
import { useAppState } from '../../../shared/hooks/useAppState';
import { qaLog } from '../../../shared/utils/qaLog';
import { levelUpSession } from '../levelUpSession';
import { useMyLevel } from './useMyLevel';

type Options = {
  /** Opens LevelUp for one level-up; false when navigation is not ready (nothing is marked). */
  open: (levelUp: PendingLevelUpDto) => boolean;
  /** A LevelUp screen is on top right now. */
  isOpen: () => boolean;
};

/**
 * The level-up queue (AC7), mounted once in the app shell. Signed in, it refetches the level on
 * every return to the foreground; whenever the level has pending level-ups and no LevelUp is
 * open, it opens the oldest one not yet shown this session. A level-up whose `seen` call failed
 * after Continue gets `seen` again on the next refetch.
 */
export function useLevelUpQueue({ open, isOpen }: Options): void {
  const { status } = useAuth();
  // `dataUpdatedAt`: an unchanged body after a refetch still counts (retry `seen`).
  const { data, dataUpdatedAt, isPlaceholderData, refetch } = useMyLevel();
  const appState = useAppState();
  const previousAppState = useRef(appState);
  const { mutate: markSeen } = useMeLevelMarkLevelUpSeen({ mutation: { meta: { silentError: true } } });

  useEffect(() => {
    levelUpSession.reset();
  }, []);

  useEffect(() => {
    const was = previousAppState.current;
    previousAppState.current = appState;
    if (status === 'signedIn' && appState === 'active' && was !== 'active') {
      void refetch();
    }
  }, [appState, status, refetch]);

  useEffect(() => {
    if (status !== 'signedIn' || !data || isPlaceholderData) {
      return;
    }
    data.pendingLevelUps
      .filter(item => levelUpSession.isContinued(item.id))
      .forEach(item =>
        markSeen(
          { id: item.id },
          {
            onError: error =>
              qaLog('levelup_seen_failed', { to: item.toLevel, code: isApiError(error) ? error.code : 'unknown' }),
          },
        ),
      );
    if (isOpen()) {
      return;
    }
    const next = levelUpSession.next(data.pendingLevelUps);
    if (next && open(next)) {
      levelUpSession.markShown(next.id);
    }
  }, [status, data, dataUpdatedAt, isPlaceholderData, markSeen, open, isOpen]);
}
