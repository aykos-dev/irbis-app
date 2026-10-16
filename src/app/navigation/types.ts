import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Every param list in the app. Params carry ids, never objects (engineering-standards §7).
 * M0 has a single Status screen; Onboarding, Auth and MainTabs arrive with their features.
 */
export type RootStackParamList = {
  Status: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/** Types `useNavigation()` and `Link` app-wide (React Navigation's global param list). */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
