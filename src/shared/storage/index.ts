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
