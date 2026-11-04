import { useCallback } from 'react';

import { useAuthCreateDemo } from '../api/generated/auth/auth';
import { useAuth } from '../contexts/auth';
import { getLocale } from '../i18n';
import { qaLog } from '../utils/qaLog';

/** Make an anonymous persistent action possible without showing the account gate. */
export function useGuestSession(reason: string) {
  const auth = useAuth();
  const demo = useAuthCreateDemo({ mutation: { meta: { silentError: true } } });
  const ensure = useCallback(async (): Promise<void> => {
    if (auth.status === 'signedIn') return;
    const session = await demo.mutateAsync({ data: { locale: getLocale() } });
    await auth.startSession(session);
    qaLog('demo_account_created', { reason });
  }, [auth, demo, reason]);
  return { ensure, loading: demo.isPending };
}

