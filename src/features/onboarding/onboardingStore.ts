import {
  Experience as ApiExperience,
  Interest as ApiInterest,
  type GuestOnboardingDto,
} from '../../shared/api/generated/model';
import { registerGuestItem } from '../../shared/guest/guestStore';
import { storage } from '../../shared/storage';

/** Hiking experience picked on the Experience step (features/onboarding.md AC4). */
export const experiences = ['beginner', 'weekend', 'experienced'] as const;
export type Experience = (typeof experiences)[number];

/** Interests in canonical order (AC5); saved lists always follow this order. */
export const interests = ['peaks', 'caves', 'lakes', 'camping', 'trails'] as const;
export type Interest = (typeof interests)[number];

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
  clearOnboardingChoices();
}

function isExperience(value: string | undefined): value is Experience {
  return experiences.some(experience => experience === value);
}

function isInterest(value: unknown): value is Interest {
  return interests.some(interest => interest === value);
}

export function saveExperience(experience: Experience): void {
  storage.setString('onboarding.experience', experience);
}

export function getExperience(): Experience | undefined {
  const saved = storage.getString('onboarding.experience');
  return isExperience(saved) ? saved : undefined;
}

export function saveInterests(chosen: readonly Interest[]): void {
  const ordered = interests.filter(interest => chosen.includes(interest));
  storage.setString('onboarding.interests', JSON.stringify(ordered));
}

/** Saved interests; an unreadable value counts as none (it is rewritten on the next Continue). */
export function getInterests(): Interest[] {
  const saved = storage.getString('onboarding.interests');
  if (!saved) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isInterest) : [];
}

/** ✕ on any step: nothing chosen in onboarding is kept (the language stays). */
export function clearOnboardingChoices(): void {
  storage.remove('onboarding.experience');
  storage.remove('onboarding.interests');
}

const apiExperiences: readonly string[] = Object.values(ApiExperience);
const apiInterests: readonly string[] = Object.values(ApiInterest);

function isApiExperience(value: string | undefined): value is ApiExperience {
  return value !== undefined && apiExperiences.includes(value);
}

function isApiInterest(value: string): value is ApiInterest {
  return apiInterests.includes(value);
}

/**
 * The guest's onboarding choices for `/v1/me/guest-merge` (AC7): unset or empty keys are left out,
 * nothing at all after ✕. Values the API does not know are dropped. The local copy stays after merge.
 */
export function collectOnboardingChoices(): GuestOnboardingDto | undefined {
  const onboarding: GuestOnboardingDto = {};
  const experience = getExperience();
  if (isApiExperience(experience)) {
    onboarding.experience = experience;
  }
  const chosen = getInterests().filter(isApiInterest);
  if (chosen.length > 0) {
    onboarding.interests = chosen;
  }
  return onboarding.experience || onboarding.interests ? onboarding : undefined;
}

registerGuestItem({
  id: 'onboarding',
  collect: () => {
    const onboarding = collectOnboardingChoices();
    return onboarding ? { onboarding } : undefined;
  },
});
