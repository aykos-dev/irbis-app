import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import { RecoveryPhoneScreen } from '../../features/auth/screens/RecoveryPhoneScreen';
import { DebugScreen } from '../../features/debug/screens/DebugScreen';
import { StatusScreen } from '../../features/health/screens/StatusScreen';
import { CompanionsScreen } from '../../features/levels/screens/CompanionsScreen';
import { LevelUpScreen } from '../../features/levels/screens/LevelUpScreen';
import { LevelScreen } from '../../features/levels/screens/LevelScreen';
import { PlaceScreen } from '../../features/places/screens/PlaceScreen';
import { OnboardingNavigator } from '../../features/onboarding/OnboardingNavigator';
import { isOnboardingDone, markOnboardingDone } from '../../features/onboarding/onboardingStore';
import { SafetyScreen } from '../../features/auth/screens/SafetyScreen';
import { appConfig } from '../../shared/constants/config';
import { useAuth } from '../../shared/contexts/auth';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type InitialRoute = 'Onboarding' | 'MainTabs';

/**
 * First launch opens onboarding: no `onboarding.done` and no session. Anyone else lands on the
 * tabs, never behind a log-in wall. Null while the stored session is still being read.
 */
function useInitialRoute(): InitialRoute | null {
  const { status } = useAuth();
  const [done] = useState(isOnboardingDone);

  useEffect(() => {
    if (status === 'signedIn') {
      markOnboardingDone();
    }
  }, [status]);

  if (done) {
    return 'MainTabs';
  }
  if (status === 'loading') {
    return null;
  }
  return status === 'signedIn' ? 'MainTabs' : 'Onboarding';
}

/**
 * Root stack. Onboarding on first launch (onboarding AC1), otherwise the tabs (auth AC1). Auth is
 * a modal stack over both. Debug and Status are registered outside production only (AC7, AC10).
 */
export function RootNavigator() {
  const initialRoute = useInitialRoute();
  if (!initialRoute) {
    return null;
  }
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="Auth"
        component={AuthNavigator}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="RecoveryPhone" component={RecoveryPhoneScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      <Stack.Screen name="Place" component={PlaceScreen} />
      <Stack.Screen name="Level" component={LevelScreen} />
      <Stack.Screen name="Companions" component={CompanionsScreen} />
      <Stack.Screen
        name="LevelUp"
        component={LevelUpScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
      />
      {appConfig.isQaEnabled ? (
        <>
          <Stack.Screen name="Debug" component={DebugScreen} />
          <Stack.Screen name="Status" component={StatusScreen} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
