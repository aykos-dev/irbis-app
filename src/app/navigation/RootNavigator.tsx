import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { StatusScreen } from '../../features/health/screens/StatusScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Status" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Status" component={StatusScreen} />
    </Stack.Navigator>
  );
}
