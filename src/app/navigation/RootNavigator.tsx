import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RecoveryPhoneScreen } from '../../features/auth/screens/RecoveryPhoneScreen';
import { DebugScreen } from '../../features/debug/screens/DebugScreen';
import { StatusScreen } from '../../features/health/screens/StatusScreen';
import { SafetyScreen } from '../../features/auth/screens/SafetyScreen';
import { appConfig } from '../../shared/constants/config';
import { AuthNavigator } from './AuthNavigator';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack. Cold start lands on the tabs, never behind a log-in wall (AC1). Auth is a modal
 * stack over the tabs. Debug and Status are registered outside production only (AC7, AC10).
 */
export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="MainTabs" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen
        name="Auth"
        component={AuthNavigator}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="RecoveryPhone" component={RecoveryPhoneScreen} />
      <Stack.Screen name="Safety" component={SafetyScreen} />
      {appConfig.isQaEnabled ? (
        <>
          <Stack.Screen name="Debug" component={DebugScreen} />
          <Stack.Screen name="Status" component={StatusScreen} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
