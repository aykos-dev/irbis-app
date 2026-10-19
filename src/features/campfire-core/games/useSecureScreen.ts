import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { secureScreen } from '../native/secureScreen';

/**
 * Every secret screen (Imposter, Who am I) — AC3. Android: FLAG_SECURE while the screen is
 * focused, cleared on blur and unmount. iOS: `captured` is true while the screen is recorded or
 * mirrored, so the caller covers the secret.
 */
export function useSecureScreen(): { captured: boolean } {
  const [captured, setCaptured] = useState(false);

  useFocusEffect(
    useCallback(() => {
      secureScreen.setSecure(true);
      return () => secureScreen.setSecure(false);
    }, []),
  );

  useEffect(() => {
    let live = true;
    const unsubscribe = secureScreen.onCaptureChange(next => setCaptured(next));
    secureScreen.isCaptured().then(
      now => {
        if (live) {
          setCaptured(now);
        }
      },
      () => {
        // Can't tell: cover the secret rather than risk showing it to a recording.
        if (live) {
          setCaptured(true);
        }
      },
    );
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return { captured };
}
