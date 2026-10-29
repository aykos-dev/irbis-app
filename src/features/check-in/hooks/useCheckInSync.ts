import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isApiError } from '../../../shared/api/errors';
import { useCheckInsCreate } from '../../../shared/api/generated/check-ins/check-ins';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useAppState } from '../../../shared/hooks/useAppState';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { qaLog } from '../../../shared/utils/qaLog';
import { loadQueue, removeQueued } from '../checkInQueue';
import { invalidateAfterCheckIn } from './useCheckIn';

const SERVER_ERROR = 500;

/**
 * The offline check-in queue (AC5), mounted once in the app shell. Signed in, it sends queued
 * check-ins oldest first on start, on return to the foreground and on reconnect. A 4xx answer
 * (422, 404) drops that item, with one toast per run; network or 5xx keeps it and stops the run.
 */
export function useCheckInSync(): void {
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const appState = useAppState();
  const queryClient = useQueryClient();
  const { mutateAsync } = useCheckInsCreate({ mutation: { meta: { silentError: true } } });
  const syncing = useRef(false);

  const syncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  syncRef.current = async () => {
    if (syncing.current) {
      return;
    }
    syncing.current = true;
    let sent = false;
    let rejected = false;
    try {
      for (const item of loadQueue()) {
        try {
          const result = await mutateAsync({ data: item });
          removeQueued(item.clientId);
          sent = true;
          qaLog('check_in_sent', { placeId: item.placeId, counted: result.counted, xp: result.xp, queued: true });
        } catch (error) {
          if (!isApiError(error) || error.status === null || error.status >= SERVER_ERROR) {
            break;
          }
          removeQueued(item.clientId);
          rejected = true;
          qaLog('check_in_rejected', { code: error.code });
        }
      }
    } finally {
      syncing.current = false;
    }
    if (rejected) {
      toast.show({ variant: 'error', message: t('checkin.rejected') });
    }
    if (sent) {
      invalidateAfterCheckIn(queryClient);
    }
  };

  useEffect(() => {
    if (status === 'signedIn' && isOnline && appState !== 'background' && loadQueue().length > 0) {
      void syncRef.current();
    }
  }, [status, isOnline, appState]);
}
