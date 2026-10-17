import { useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';

import type { OnboardingStackParamList } from '../../app/navigation/types';
import { useAuth } from '../../shared/contexts/auth';
import { useEndOnboarding } from './hooks/useEndOnboarding';
import { LanguageScreen } from './screens/LanguageScreen';
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * Onboarding flow (features/onboarding.md). A log-in from Welcome ends it (`via: 'login'`) once
 * the auth modal has closed back onto it, so the modal's own close never targets a removed route.
 */
export function OnboardingNavigator() {
  const { status } = useAuth();
  const isFocused = useIsFocused();
  const end = useEndOnboarding();
  const [startedSignedIn] = useState(status === 'signedIn');

  useEffect(() => {
    if (isFocused && status === 'signedIn' && !startedSignedIn) {
      end('login');
    }
  }, [isFocused, status, startedSignedIn, end]);

  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Language" component={LanguageScreen} />
    </Stack.Navigator>
  );
}
