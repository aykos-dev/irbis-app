import type { GuestMergeDto } from '../api/generated/model';
import { getLocale } from '../i18n';
import { storage } from '../storage';

/**
 * Guest data lives on the device (language today; onboarding choices and more later) and goes to
 * `/v1/me/guest-merge` once, after the first sign-up or log-in on the device (AC8, Q9).
 * Features register what they keep for a guest; the auth flow collects it all.
 */
export type GuestItem = {
  id: string;
  /** What to send for this item, or undefined when the guest has nothing of it. */
  collect: () => Partial<GuestMergeDto> | undefined;
  /** Called once the merge that carried the last collected data succeeded. */
  onMerged?: () => void;
};

const registry = new Map<string, GuestItem>();

/** Later features call this at module load. Returns an unregister function. */
export function registerGuestItem(item: GuestItem): () => void {
  registry.set(item.id, item);
  return () => {
    registry.delete(item.id);
  };
}

registerGuestItem({ id: 'language', collect: () => ({ locale: getLocale() }) });

export function guestMergeDone(): boolean {
  return storage.getString('guest.merged') === '1';
}

/** After a successful merge: never again on this device; items learn their data arrived. */
export function markGuestMergeDone(): void {
  storage.setString('guest.merged', '1');
  for (const item of registry.values()) {
    item.onMerged?.();
  }
}

const settledListeners = new Set<() => void>();

/** Called after every sign-in once the guest merge is done, failed or not needed. */
export function onSignInSettled(listener: () => void): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

export function notifySignInSettled(): void {
  settledListeners.forEach(listener => listener());
}

/** QA harness only (`irbis://debug/onboarding/reset`): the next sign-in merges again, like a fresh install. */
export function resetGuestMerge(): void {
  storage.remove('guest.merged');
}

/** The merge request body: every registered item folded together (onboarding keys merge). */
export function collectGuestData(): GuestMergeDto {
  const body: GuestMergeDto = {};
  for (const item of registry.values()) {
    const part = item.collect();
    if (!part) {
      continue;
    }
    if (part.locale) {
      body.locale = part.locale;
    }
    if (part.onboarding) {
      body.onboarding = { ...body.onboarding, ...part.onboarding };
    }
    if (part.lessons) {
      body.lessons = part.lessons;
    }
  }
  return body;
}
