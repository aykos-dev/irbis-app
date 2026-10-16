import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { tokenManager } from '../api/tokenManager';

/**
 * Session state (guest-first, ADR-001). M0 only knows whether a session exists; sign-in and
 * sign-up are added by the `auth` feature. Sign-out clears the query cache, which is why this
 * provider sits inside QueryClientProvider.
 */
export type SessionStatus = 'loading' | 'guest' | 'signedIn';

type AuthState = {
  status: SessionStatus;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let active = true;
    tokenManager
      .hasSession()
      .then(hasSession => {
        if (active) {
          setStatus(hasSession ? 'signedIn' : 'guest');
        }
      })
      .catch(() => {
        if (active) {
          setStatus('guest');
        }
      });
    const unsubscribe = tokenManager.onSignOut(() => {
      queryClient.clear();
      setStatus('guest');
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthState>(() => ({ status, signOut: () => tokenManager.clear() }), [status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return auth;
}
