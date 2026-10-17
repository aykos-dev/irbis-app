import { CommonActions, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback } from 'react';

import { qaLog } from '../../../shared/utils/qaLog';
import { markOnboardingDone } from '../onboardingStore';

/** How onboarding ended: Continue on the last step, ✕, or a log-in from Welcome. */
export type OnboardingEndVia = 'finish' | 'close' | 'login';

function rootOf(navigation: NavigationProp<ParamListBase>): NavigationProp<ParamListBase> {
  let root = navigation;
  let parent = root.getParent<NavigationProp<ParamListBase> | undefined>();
  while (parent) {
    root = parent;
    parent = root.getParent<NavigationProp<ParamListBase> | undefined>();
  }
  return root;
}

/**
 * Ends onboarding, whichever way: marks it done on this device, replaces the whole stack with
 * the tabs and logs `onboarding_end`. Nothing chosen in later steps is saved on `close`.
 */
export function useEndOnboarding(): (via: OnboardingEndVia) => void {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  return useCallback(
    (via: OnboardingEndVia) => {
      markOnboardingDone();
      qaLog('onboarding_end', { via, interestsCount: 0 });
      rootOf(navigation).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
    },
    [navigation],
  );
}
