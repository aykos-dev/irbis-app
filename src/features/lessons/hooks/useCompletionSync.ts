import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { useAuth, type SessionStatus } from '../../../shared/contexts/auth';
import { onSignInSettled } from '../../../shared/guest/guestStore';
import { useAppState } from '../../../shared/hooks/useAppState';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { completionsStore } from '../completionsStore';
import { syncCompletions } from '../syncCompletions';

/**
 * Lesson completion sync (AC7), mounted once in the app shell. Signed in, it sends the queued
 * completions when the app starts, comes to the foreground, the network comes back, a lesson
 * completes, and right after log-in / sign-up (once the guest merge is settled).
 */
export function useCompletionSync(): void {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const appState = useAppState();
  const { isOnline } = useNetworkStatus();
  const statusRef = useRef(status);
  // Mounted already signed in (the navigator may mount after the session loads) counts as the start.
  const previous = useRef<{ status: SessionStatus; appState: string; isOnline: boolean }>({
    status: 'loading',
    appState,
    isOnline,
  });

  const flush = useCallback(() => {
    if (statusRef.current === 'signedIn') {
      void syncCompletions(queryClient);
    }
  }, [queryClient]);

  useEffect(() => {
    const was = previous.current;
    previous.current = { status, appState, isOnline };
    statusRef.current = status;
    if (status !== 'signedIn') {
      return;
    }
    // From `loading` is the app start with a session; from `guest` is a log-in, flushed on settle.
    const started = was.status === 'loading';
    const foregrounded = appState === 'active' && was.appState !== 'active';
    const reconnected = isOnline && !was.isOnline;
    if (started || foregrounded || reconnected) {
      flush();
    }
  }, [status, appState, isOnline, flush]);

  useEffect(() => {
    const offAdd = completionsStore.subscribe(flush);
    // The session is already started here, even if this render has not seen `signedIn` yet.
    const offSignIn = onSignInSettled(() => void syncCompletions(queryClient));
    return () => {
      offAdd();
      offSignIn();
    };
  }, [flush, queryClient]);
}
