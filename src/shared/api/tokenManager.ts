import * as Keychain from 'react-native-keychain';

/**
 * The only Keychain/Keystore user (ADR-001). Holds the access + refresh tokens; never MMKV.
 *
 * Refresh is single-flight: concurrent 401s share one in-flight refresh. The refresh call itself
 * is registered by the `auth` feature via `setRefreshHandler`; until then no refresh is possible
 * and a 401 signs the session out.
 */
const SERVICE = 'uz.irbis.app.session';

export type Tokens = { accessToken: string; refreshToken: string };

type RefreshHandler = (refreshToken: string) => Promise<Tokens>;

/**
 * Why the session ended. `user` = the user signed out; `expired` = the refresh token was refused
 * (REFRESH_INVALID / REUSED); `blocked` = the account was blocked (ACCOUNT_BLOCKED).
 */
export type SignOutEvent = { reason: 'user' | 'expired' | 'blocked'; blockReasonCode?: string };
type SignOutListener = (event: SignOutEvent) => void;

/** True when a refresh failure means the refresh token is dead (not a network blip). */
type RefreshRefusal = (error: unknown) => boolean;

let cached: Tokens | null | undefined;
let refreshHandler: RefreshHandler | null = null;
let isRefusal: RefreshRefusal = () => true;
let inFlightRefresh: Promise<string | null> | null = null;
const signOutListeners = new Set<SignOutListener>();

async function load(): Promise<Tokens | null> {
  if (cached !== undefined) {
    return cached;
  }
  const entry = await Keychain.getGenericPassword({ service: SERVICE });
  if (!entry) {
    cached = null;
    return cached;
  }
  try {
    const parsed: unknown = JSON.parse(entry.password);
    cached =
      typeof parsed === 'object' &&
      parsed !== null &&
      'accessToken' in parsed &&
      'refreshToken' in parsed &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string'
        ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export const tokenManager = {
  async getAccessToken(): Promise<string | null> {
    return (await load())?.accessToken ?? null;
  },

  async getRefreshToken(): Promise<string | null> {
    return (await load())?.refreshToken ?? null;
  },

  async hasSession(): Promise<boolean> {
    return (await load()) !== null;
  },

  async setTokens(tokens: Tokens): Promise<void> {
    await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
    cached = tokens;
  },

  async clear(event: SignOutEvent = { reason: 'user' }): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
    cached = null;
    signOutListeners.forEach(listener => listener(event));
  },

  /** `refusal` tells a dead refresh token apart from a transient failure (offline, timeout). */
  setRefreshHandler(handler: RefreshHandler | null, refusal: RefreshRefusal = () => true): void {
    refreshHandler = handler;
    isRefusal = refusal;
  },

  onSignOut(listener: SignOutListener): () => void {
    signOutListeners.add(listener);
    return () => {
      signOutListeners.delete(listener);
    };
  },

  /**
   * Returns a fresh access token, or null when the refresh token was refused (session over).
   * Transient failures (offline, timeout) reject instead, so the session survives a bad network.
   */
  refresh(): Promise<string | null> {
    if (inFlightRefresh) {
      return inFlightRefresh;
    }
    inFlightRefresh = (async () => {
      const current = await load();
      if (!current || !refreshHandler) {
        return null;
      }
      try {
        const next = await refreshHandler(current.refreshToken);
        await tokenManager.setTokens({
          accessToken: next.accessToken,
          refreshToken: next.refreshToken,
        });
        return next.accessToken;
      } catch (error) {
        if (isRefusal(error)) {
          return null;
        }
        throw error;
      }
    })().finally(() => {
      inFlightRefresh = null;
    });
    return inFlightRefresh;
  },
};
