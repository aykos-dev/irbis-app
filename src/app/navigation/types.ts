import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Every param list in the app. Params carry ids and plain values, never objects
 * (engineering-standards §7).
 */

/** Auth modal stack (canvas page "Accounts & sign-in"). */
export type AuthStackParamList = {
  LogIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetCode: { username: string; resendAfterSec: number };
};

/**
 * Onboarding stack (features/onboarding.md): Splash → Welcome → Language → Experience → Interests
 * → Companion.
 */
export type OnboardingStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Language: undefined;
  Experience: undefined;
  Interests: undefined;
  Companion: undefined;
};

/** Bottom tabs, per canvas Nav. */
export type MainTabParamList = {
  Path: undefined;
  Explore: undefined;
  Lessons: undefined;
  Community: undefined;
  Profile: undefined;
};

/**
 * QA level grant from `irbis://debug/levels/grant` (levels AC8): `grant` marks a grant request,
 * the rest are counts, every one optional.
 */
export type DebugGrantParams = {
  grant: true;
  xp?: number;
  lessons?: number;
  tier?: string;
  checkins?: number;
  difficulty?: number;
  spots?: number;
};

export type RootStackParamList = {
  /** First launch only (no `onboarding.done`, no session). */
  Onboarding: NavigatorScreenParams<OnboardingStackParamList> | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  RecoveryPhone: undefined;
  /** Safety & SOS: its empty state until `safety-center` ships. */
  Safety: undefined;
  /** Dev and staging builds only. Grant params come from the QA grant link (levels AC8). */
  Debug: DebugGrantParams | undefined;
  Status: undefined;
  /** Place screen (places AC7). Explore passes the device position when it has one. */
  Place: { id: string; lat?: number; lng?: number };
  /** Level screen (levels AC5): your level, or level 1 for a guest. */
  Level: undefined;
  /** All seven companions (levels AC6). */
  Companions: undefined;
  /** Full-screen level-up celebration for one pending level-up (levels AC7). */
  LevelUp: {
    id: string;
    fromLevel: number;
    toLevel: number;
    maxDifficulty: number;
    newPlacesCount: number;
  };
  /** Campfire host lobby (campfire-core AC4, AC6, AC7); `resume` reopens the saved room. */
  CampLobby: { resume?: boolean } | undefined;
  /** Campfire join screen (campfire-core slice 3; coming-soon stub until then). */
  CampJoin: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AuthStackParamList, T>,
  RootStackScreenProps<'Auth'>
>;

export type OnboardingStackScreenProps<T extends keyof OnboardingStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<OnboardingStackParamList, T>,
    RootStackScreenProps<'Onboarding'>
  >;

export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<'MainTabs'>
>;

/** Types `useNavigation()` and `Link` app-wide (React Navigation's global param list). */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
