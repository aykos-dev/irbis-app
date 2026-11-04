import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isApiError } from '../../../shared/api/errors';
import { useAuthCreateDemo } from '../../../shared/api/generated/auth/auth';
import { useCheckInsCreate } from '../../../shared/api/generated/check-ins/check-ins';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useAppState } from '../../../shared/hooks/useAppState';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { getLocale, t } from '../../../shared/i18n';
import { qaLog } from '../../../shared/utils/qaLog';
import { loadQueue, onQueued, removeQueued } from '../checkInQueue';
import { invalidateAfterCheckIn } from './useCheckIn';

const SERVER_ERROR = 500;

/**
 * The offline check-in queue (AC5), mounted once in the app shell. Online, it sends queued
 * check-ins oldest first on start, on return to the foreground, on reconnect and when one is
 * queued. A 4xx answer (422, 404) drops that item, with one toast per run; network or 5xx keeps
 * it and stops the run. A guest first gets a demo account (AC6, ADR-006), stored exactly like a
 * sign-up (which runs the guest merge); any failure there (429 DEMO_LIMIT / RATE_LIMITED,
 * network) keeps the queue for the next trigger. One run at a time, so never two demo accounts.
 */
export function useCheckInSync(): void {
  const { status, startSession } = useAuth();
  const { isOnline } = useNetworkStatus();
  const appState = useAppState();
  const queryClient = useQueryClient();
  const { mutateAsync } = useCheckInsCreate({ mutation: { meta: { silentError: true } } });
  const { mutateAsync: createDemoAsync } = useAuthCreateDemo({ mutation: { meta: { silentError: true } } });
  const syncing = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  /** Guest → demo account; false when it could not be created (the queue waits). */
  const ensureAccount = async (): Promise<boolean> => {
    if (statusRef.current === 'signedIn') {
      return true;
    }
    try {
      const session = await createDemoAsync({ data: { locale: getLocale() } });
      await startSession(session);
      qaLog('demo_account_created');
      toast.show({ variant: 'success', message: t('checkin.demo.saved', { username: session.me.username }) });
      return true;
    } catch (error) {
      qaLog('demo_account_failed', { code: isApiError(error) ? error.code : 'unknown' });
      return false;
    }
  };

  const syncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  syncRef.current = async () => {
    if (syncing.current) {
      return;
    }
    syncing.current = true;
    let sent = false;
    let rejected = false;
    try {
      if (!(await ensureAccount())) {
        return;
      }
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

  const ready = status !== 'loading' && isOnline && appState !== 'background';
  useEffect(() => {
    if (ready && loadQueue().length > 0) {
      void syncRef.current();
    }
    return ready ? onQueued(() => void syncRef.current()) : undefined;
  }, [ready, status]);
}
