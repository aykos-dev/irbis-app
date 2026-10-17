import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { ForgotPasswordScreen } from '../../features/auth/screens/ForgotPasswordScreen';
import { LogInScreen } from '../../features/auth/screens/LogInScreen';
import { ResetCodeScreen } from '../../features/auth/screens/ResetCodeScreen';
import { SignUpScreen } from '../../features/auth/screens/SignUpScreen';
import { authGate } from '../../shared/auth/gateBus';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * The auth modal stack: LogIn · SignUp · ForgotPassword → ResetCode. Closing it without signing
 * in drops the gated action that opened it (a sign-in clears it first by resuming it).
 */
export function AuthNavigator() {
  useEffect(() => () => authGate.cancel(), []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LogIn" component={LogInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetCode" component={ResetCodeScreen} />
    </Stack.Navigator>
  );
}
