import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { clearTripDevice } from '../../features/active-trip/tripDevice';
import { ProfileScreen } from '../../features/auth/screens/ProfileScreen';
import { CommunityScreen } from '../../features/campfire-core/screens/CommunityScreen';
import { LessonsHubScreen } from '../../features/lessons/screens/LessonsHubScreen';
import { getInterests } from '../../features/onboarding/onboardingStore';
import { placeTypes } from '../../features/places/placeTypes';
import { ExploreScreen } from '../../features/places/screens/ExploreScreen';
import { ProfileStreaksCard } from '../../features/streaks/components/ProfileStreaksCard';
import { StreakChips } from '../../features/streaks/components/StreakChips';
import { StreakLessonsLine } from '../../features/streaks/components/StreakLessonsLine';
import { TripCard } from '../../features/trip-plan/components/TripCard';
import { PathScreen } from '../../features/weekly-path/screens/PathScreen';
import type { PlaceType } from '../../shared/api/generated/model';
import { TabBar } from './TabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Path's inputs from other features (features never import each other). */
const placeType = (type: PlaceType) => placeTypes[type];

/**
 * Explore is the places map (places AC4–AC6), Lessons the lessons hub (lessons AC4), Community the campfire hub
 * (campfire-core AC1), Path this month's path (weekly-path AC1). Streaks (AC6, AC7) are slotted into Path, Lessons
 * and Profile here.
 */
export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Path"
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Path">
        {props => (
          <PathScreen
            {...props}
            readInterests={getInterests}
            placeType={placeType}
            tripCard={<TripCard onCheckedOut={clearTripDevice} />}
            streakChips={<StreakChips />}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Lessons">{props => <LessonsHubScreen {...props} streakLine={<StreakLessonsLine />} />}</Tab.Screen>
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Profile">{props => <ProfileScreen {...props} streaksCard={<ProfileStreaksCard />} />}</Tab.Screen>
    </Tab.Navigator>
  );
}
