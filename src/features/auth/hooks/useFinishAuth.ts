import { useCallback } from 'react';

import type { AuthSessionResponseDto } from '../../../shared/api/generated/model';
import { toast } from '../../../shared/components/toastBus';
import { authGate } from '../../../shared/auth/gateBus';
import { useAuth } from '../../../shared/contexts/auth';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { useCloseAuth } from './useCloseAuth';

/**
 * A sign-up, log-in or password reset succeeded: store the session (which also sends the guest
 * data once), tell the user, close the modal back to where it started, then continue the gated
 * action that opened it, once.
 */
export function useFinishAuth(): (session: AuthSessionResponseDto, toastKey: string) => Promise<void> {
  const { startSession } = useAuth();
  const close = useCloseAuth();

  return useCallback(
    async (session, toastKey) => {
      await startSession(session);
      haptics.success();
      toast.show({ variant: 'success', message: t(toastKey) });
      close();
      authGate.resume();
    },
    [startSession, close],
  );
}
