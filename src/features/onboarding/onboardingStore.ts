import { storage } from '../../shared/storage';

/** Onboarding shows once per device: until it ends, or until the app opens already signed in. */
export function isOnboardingDone(): boolean {
  return storage.getString('onboarding.done') === '1';
}

export function markOnboardingDone(): void {
  storage.setString('onboarding.done', '1');
}

/** QA harness only (`irbis://debug/onboarding/reset`). */
export function resetOnboarding(): void {
  storage.remove('onboarding.done');
}
