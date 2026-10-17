import { useCallback } from 'react';

import { authGate, type GateReason } from '../auth/gateBus';
import { useAuth } from '../contexts/auth';

/**
 * Gate for anything that saves or earns (ADR-001, AC7).
 *
 *   const requireAccount = useRequireAccount('xp');
 *   requireAccount(() => saveProgress());
 *
 * Signed in: runs the action now. Guest: opens the log-in prompt and runs the action once after
 * sign-up / log-in; "Not now" drops it and nothing is lost.
 */
export function useRequireAccount(reason: GateReason): (action: () => void) => void {
  const { status } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (status === 'signedIn') {
        action();
        return;
      }
      authGate.open(reason, action);
    },
    [status, reason],
  );
}
