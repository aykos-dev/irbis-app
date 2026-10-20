import { createMMKV } from 'react-native-mmkv';

/**
 * The only MMKV user. Non-sensitive state only (prefs, drafts, last-known-good UI state).
 * Tokens never go here — they live in the Keychain via shared/api/tokenManager.
 */
const mmkv = createMMKV({ id: 'irbis' });

/** Every persisted key, with its value type. Add keys here, never inline strings. */
type StorageSchema = {
  'prefs.locale': string;
  'prefs.colorScheme': string;
  /** '1' once the device's guest data went into an account (`/v1/me/guest-merge`, once per device). */
  'guest.merged': string;
  /** '1' once onboarding ended (finished, closed or logged in) or the app opened signed in. */
  'onboarding.done': string;
  /** Onboarding experience choice (`beginner` | `weekend` | `experienced`), saved on Continue. */
  'onboarding.experience': string;
  /** Onboarding interests: JSON array of ids in canonical order, saved on Continue. */
  'onboarding.interests': string;
  /** Explore's last loaded list for offline restarts: JSON `{ filters, data }` (no personal data). */
  'explore.lastList': string;
  /** The signed-in user's last loaded level for offline opens: JSON `{ userId, data }` (MyLevelDto). */
  'levels.lastMyLevel': string;
  /** The last loaded level table (`/v1/levels`) for offline opens: JSON LevelListResponseDto. */
  'levels.defs': string;
  /** Campfire player profile, saved on the player sheet's Continue: JSON `{ nickname, animal }`. */
  'camp.profile': string;
  /** The hosted Campfire room for resume (12 h): JSON `{ savedAt, room }` with seats and seat tokens. */
  'camp.hostRoom': string;
  /** The host's last Mafia setup: JSON `{ counts, revealOut }` (no personal data). */
  'camp.maf.setup': string;
  /** Today's lesson hearts: JSON `{ day: 'YYYY-MM-DD' (Tashkent), hearts }`; kept on sign-out. */
  'lessons.hearts': string;
  /** The last loaded lesson catalog for offline opens: JSON `{ userId, day, data }` (LessonCatalog). */
  'lessons.catalog': string;
  /** Lessons opened online, for offline replays: JSON `{ [lessonId]: PublicLesson }`. */
  'lessons.cache': string;
  /** First lesson completions on this device: JSON array of LocalCompletion (synced by slice 4). */
  'lessons.completions': string;
  /** '1' when quiz sounds are off; absent or '0' = on. */
  'lessons.muted': string;
} & {
  /** Campfire seat token per room code, so a player gets the same seat back (rejoin, restart). */
  [key: `camp.seats.${string}`]: string;
  /** Campfire pack items already dealt, per `<game>.<packId>`: JSON array of item ids (no-repeat). */
  [key: `camp.used.${string}`]: string;
  /** The last loaded monthly path per Tashkent month `YYYY-MM`, for offline opens: JSON PathDto (no personal data). */
  [key: `path.cache.${string}`]: string;
};

export type StorageKey = keyof StorageSchema;

export const storage = {
  getString<K extends StorageKey>(key: K): StorageSchema[K] | undefined {
    return mmkv.getString(key);
  },
  setString<K extends StorageKey>(key: K, value: StorageSchema[K]): void {
    mmkv.set(key, value);
  },
  remove(key: StorageKey): void {
    mmkv.remove(key);
  },
  /** Test and sign-out-everywhere hook; never called in normal flows. */
  clearAll(): void {
    mmkv.clearAll();
  },
};
