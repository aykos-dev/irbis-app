import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuthRefresh, useAuthSignOut } from '../api/generated/auth/auth';
import {
  getMeGetQueryKey,
  useMeGet,
  useMeGuestMerge,
} from '../api/generated/me/me';
import type {
  AuthSessionResponseDto,
  MeResponseDto,
} from '../api/generated/model';
import { apiErrorCodes, isApiError } from '../api/errors';
import { staleTimes } from '../api/query';
import { tokenManager } from '../api/tokenManager';
import { toast } from '../components/toastBus';
import {
  collectGuestData,
  guestMergeDone,
  markGuestMergeDone,
} from '../guest/guestStore';
import { getLocale, setLocale, t } from '../i18n';
import { qaLog } from '../utils/qaLog';

/**
 * Session state (guest-first, ADR-001): guest until a sign-up / log-in / reset succeeds, then
 * signed in until sign-out, a dead refresh token (→ guest + toast) or a block (→ guest + the
 * blocked card). Sign-out clears the query cache, which is why this provider sits inside
 * QueryClientProvider.
 */
export type SessionStatus = 'loading' | 'guest' | 'signedIn';

/** The "Your account is blocked" card on A1; `reasonCode` is the category, when known. */
export type BlockedNotice = { reasonCode: string | null };

export type StartSessionOptions = { applyAccountLocale?: boolean };

type AuthState = {
  status: SessionStatus;
  user: MeResponseDto | null;
  /** The signed-in user failed to load (offline, server down); `reloadUser` retries. */
  userError: unknown;
  reloadUser: () => void;
  blockedNotice: BlockedNotice | null;
  /**
   * Store the tokens from a sign-up / log-in / reset response and move to signed in. After a
   * log-in (`applyAccountLocale`) the account language replaces the device one (AC8).
   */
  startSession: (
    session: AuthSessionResponseDto,
    options?: StartSessionOptions,
  ) => Promise<void>;
  /** Replace the cached user (after the recovery phone was verified). */
  setUser: (me: MeResponseDto) => void;
  signOut: () => Promise<void>;
  showBlocked: (reasonCode?: string) => void;
  clearBlocked: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** A dead refresh token (or a blocked account) ends the session; a network blip must not. */
function isRefusal(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  return (
    error.code === apiErrorCodes.refreshInvalid ||
    error.code === apiErrorCodes.refreshReused ||
    error.code === apiErrorCodes.accountBlocked ||
    error.status === 401
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [blockedNotice, setBlockedNotice] = useState<BlockedNotice | null>(
    null,
  );

  const { mutateAsync: refreshAsync } = useAuthRefresh({
    mutation: { meta: { silentError: true } },
  });
  const { mutateAsync: signOutAsync } = useAuthSignOut({
    mutation: { meta: { silentError: true } },
  });
  const { mutateAsync: mergeAsync } = useMeGuestMerge({
    mutation: { meta: { silentError: true } },
  });
  const me = useMeGet({
    query: { enabled: status === 'signedIn', staleTime: staleTimes.profile },
  });

  const refreshRef = useRef(refreshAsync);
  refreshRef.current = refreshAsync;

  useEffect(() => {
    let active = true;
    tokenManager.setRefreshHandler(
      refreshToken => refreshRef.current({ data: { refreshToken } }),
      isRefusal,
    );
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
    const unsubscribe = tokenManager.onSignOut(event => {
      queryClient.clear();
      setStatus('guest');
      if (event.reason === 'blocked') {
        setBlockedNotice({ reasonCode: event.blockReasonCode ?? null });
      } else if (event.reason === 'expired') {
        toast.show({ variant: 'info', message: t('auth.session.ended') });
      }
    });
    return () => {
      active = false;
      tokenManager.setRefreshHandler(null);
      unsubscribe();
    };
  }, [queryClient]);

  const mergeGuestData = useCallback(async () => {
    if (guestMergeDone()) {
      return;
    }
    try {
      const result = await mergeAsync({ data: collectGuestData() });
      markGuestMergeDone();
      qaLog('guest_merged', { items: result.merged.length });
      qaLog('guest_merge_result', {
        merged: result.merged.join(','),
        skipped: result.skipped.join(','),
      });
    } catch {
      // Not marked done: the next sign-in on this device retries. The guest data stays on the phone.
    }
  }, [mergeAsync]);

  const startSession = useCallback(
    async (session: AuthSessionResponseDto, options?: StartSessionOptions) => {
      await tokenManager.setTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      queryClient.setQueryData(getMeGetQueryKey(), session.me);
      setBlockedNotice(null);
      setStatus('signedIn');
      await mergeGuestData();
      if (options?.applyAccountLocale && session.me.locale !== getLocale()) {
        setLocale(session.me.locale);
        qaLog('locale_applied', { locale: session.me.locale });
      }
    },
    [queryClient, mergeGuestData],
  );

  const setUser = useCallback(
    (next: MeResponseDto) => {
      queryClient.setQueryData(getMeGetQueryKey(), next);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await tokenManager.getRefreshToken();
    try {
      if (refreshToken) {
        await signOutAsync({ data: { refreshToken } });
      }
    } catch {
      // Signing out always works locally, even offline; the server revokes the family on expiry.
    }
    qaLog('signed_out');
    await tokenManager.clear({ reason: 'user' });
  }, [signOutAsync]);

  const showBlocked = useCallback((reasonCode?: string) => {
    setBlockedNotice({ reasonCode: reasonCode ?? null });
  }, []);
  const clearBlocked = useCallback(() => setBlockedNotice(null), []);

  const user = status === 'signedIn' ? (me.data ?? null) : null;
  const userError = status === 'signedIn' && !me.data ? me.error : null;
  const { refetch: refetchMe } = me;
  const reloadUser = useCallback(() => {
    void refetchMe();
  }, [refetchMe]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      userError,
      reloadUser,
      blockedNotice,
      startSession,
      setUser,
      signOut,
      showBlocked,
      clearBlocked,
    }),
    [
      status,
      user,
      userError,
      reloadUser,
      blockedNotice,
      startSession,
      setUser,
      signOut,
      showBlocked,
      clearBlocked,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return auth;
}
