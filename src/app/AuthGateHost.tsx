import { useCallback, useEffect, useRef, useState } from 'react';

import { AuthGateSheet } from '../features/auth/components/AuthGateSheet';
import { authGate, type GateReason } from '../shared/auth/gateBus';
import { useAuth } from '../shared/contexts/auth';
import { qaLog } from '../shared/utils/qaLog';
import { navigationRef } from './navigation/navigationRef';

type Next = 'SignUp' | 'LogIn';

/**
 * Session-level UI that sits above the navigator: the log-in prompt (A3) when a guest hits a
 * gated action, and the redirect to the blocked state on A1 when the account gets blocked.
 * Lives inside the navigation container so it can navigate.
 */
export function AuthGateHost() {
  const [reason, setReason] = useState<GateReason | null>(null);
  const [closing, setClosing] = useState(false);
  const next = useRef<Next | null>(null);
  const { blockedNotice } = useAuth();

  // A signed-in user who gets blocked lands on the log-in screen's blocked state (AC11).
  useEffect(() => {
    if (blockedNotice && navigationRef.isReady()) {
      navigationRef.navigate('Auth', { screen: 'LogIn' });
    }
  }, [blockedNotice]);

  useEffect(
    () =>
      authGate.subscribe(opened => {
        if (opened) {
          next.current = null;
          setClosing(false);
          setReason(opened);
          qaLog('auth_gate_shown', { reason: opened });
        }
      }),
    [],
  );

  const choose = useCallback((screen: Next) => {
    next.current = screen;
    setClosing(true);
  }, []);

  const notNow = useCallback(() => {
    setClosing(true);
  }, []);

  const handleDismiss = useCallback(() => {
    const destination = next.current;
    next.current = null;
    const shownFor = reason;
    setReason(null);
    setClosing(false);
    authGate.closed();
    if (destination) {
      navigationRef.navigate('Auth', { screen: destination });
    } else {
      authGate.cancel();
      if (shownFor) {
        qaLog('auth_gate_dismissed', { reason: shownFor });
      }
    }
  }, [reason]);

  if (!reason) {
    return null;
  }
  return (
    <AuthGateSheet
      reason={reason}
      closing={closing}
      onCreate={() => choose('SignUp')}
      onLogIn={() => choose('LogIn')}
      onNotNow={notNow}
      onDismiss={handleDismiss}
    />
  );
}
