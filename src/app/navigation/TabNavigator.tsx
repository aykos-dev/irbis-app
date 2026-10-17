import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ProfileScreen } from '../../features/auth/screens/ProfileScreen';
import { ExploreScreen } from '../../features/places/screens/ExploreScreen';
import { ComingSoon } from '../../shared/components/ComingSoon';
import { TabBar } from './TabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Explore is the places map (places AC4–AC6); Path, Lessons, Community show the approved coming-soon state until their feature ships. */
export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Path"
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Path" component={ComingSoon} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Lessons" component={ComingSoon} />
      <Tab.Screen name="Community" component={ComingSoon} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
