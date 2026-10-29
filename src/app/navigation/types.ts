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

/** QA path visit from `irbis://debug/path/visit/<placeId>` (weekly-path AC4). */
export type DebugPathVisitParams = { pathVisit: string };

export type RootStackParamList = {
  /** First launch only (no `onboarding.done`, no session). */
  Onboarding: NavigatorScreenParams<OnboardingStackParamList> | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  RecoveryPhone: undefined;
  /** Safety & SOS: its empty state until `safety-center` ships. */
  Safety: undefined;
  /**
   * Dev and staging builds only. Grant params come from the QA grant link (levels AC8), visit
   * params from the QA path visit link (weekly-path AC4).
   */
  Debug: DebugGrantParams | DebugPathVisitParams | undefined;
  Status: undefined;
  /** Place screen (places AC7). Explore passes the device position when it has one. */
  Place: { id: string; lat?: number; lng?: number };
  /** Trip plan for one place (trip-plan AC1–AC6); `tripId` edits a saved plan. */
  TripPlan: { placeId: string; tripId?: string };
  /** The running trip (active-trip AC1–AC4, AC8). */
  ActiveTrip: { tripId: string };
  /** After check-out (active-trip AC8): the checked-out trip's counts. */
  TripSummary: { tripId: string; distanceM: number; climbM: number; durationMin: number; waypoints: number; xp: number };
  /**
   * Summit after a check-in (check-in AC7). `queued`: stored offline, no result yet (counted and
   * xp unused). `elevationM` is absent when the place detail could not be loaded.
   */
  Summit: {
    placeId: string;
    placeName: string;
    placeType: string;
    elevationM?: number;
    queued: boolean;
    counted: boolean;
    xp: number;
  };
  /** Level screen (levels AC5): your level, or level 1 for a guest. */
  Level: undefined;
  /** All seven companions (levels AC6). */
  Companions: undefined;
  /** Full-screen level-up celebration for one pending level-up (levels AC7). */
  /** One lesson's quiz (lessons AC5; opened from the hub, AC4). */
  Quiz: { lessonId: string };
  /** After the last right answer (lessons AC7): counts of the run that just ended. */
  LessonComplete: { lessonId: string; practice: boolean; perfect: boolean; firstTry: number; total: number };
  LevelUp: {
    id: string;
    fromLevel: number;
    toLevel: number;
    maxDifficulty: number;
    newPlacesCount: number;
  };
  /**
   * Campfire lobby (campfire-core AC4, AC6, AC7): the host's by default, `resume` reopens the saved
   * room; `player` shows the seated player's lobby (the live session is in `playerSession`);
   * `game` preselects a game (CampHub tile, campfire-party AC1, campfire-mafia AC1).
   */
  CampLobby:
    | {
        resume?: boolean;
        player?: boolean;
        game?: 'imposter' | 'mafia' | 'whoami' | 'rather' | 'xo' | 'croc';
      }
    | undefined;
  /** A party game round over the lobby (campfire-party AC2): the host's, or the player's with `player`. */
  CampGame: { player?: boolean } | undefined;
  /** Campfire join: QR scan or room code (campfire-core AC5). */
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
