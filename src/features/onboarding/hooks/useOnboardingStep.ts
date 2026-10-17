import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { qaLog } from '../../../shared/utils/qaLog';

export type OnboardingStep = 'splash' | 'welcome' | 'language';

/** Logs `onboarding_step` each time the step's screen gains focus. */
export function useOnboardingStep(step: OnboardingStep): void {
  useFocusEffect(
    useCallback(() => {
      qaLog('onboarding_step', { step });
    }, [step]),
  );
}
