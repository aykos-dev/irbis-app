import { storage } from '../../shared/storage';

/** Avatar animals, in chip order. */
export const animals = ['fox', 'ibex', 'bear', 'marmot', 'eagle', 'panda'] as const;
export type Animal = (typeof animals)[number];

/** The companion level whose art draws each animal (`CompanionArt`). */
export const animalLevel: Record<Animal, number> = {
  panda: 1,
  marmot: 2,
  fox: 3,
  ibex: 4,
  bear: 5,
  eagle: 6,
};

export const DEFAULT_ANIMAL: Animal = 'fox';
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;

export type PlayerProfile = { nickname: string; animal: Animal };

function isAnimal(value: unknown): value is Animal {
  return animals.some(animal => animal === value);
}

/** Trimmed nickname when it has 2–16 characters, otherwise null. */
export function validNickname(raw: string): string | null {
  const value = raw.trim();
  const length = Array.from(value).length;
  return length >= NICKNAME_MIN && length <= NICKNAME_MAX ? value : null;
}

function isProfile(value: unknown): value is PlayerProfile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nickname' in value &&
    'animal' in value &&
    typeof value.nickname === 'string' &&
    isAnimal(value.animal)
  );
}

/** The saved profile, or null when none was saved. An unreadable entry is dropped. */
export function readProfile(): PlayerProfile | null {
  const raw = storage.getString('camp.profile');
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isProfile(parsed)) {
      return { nickname: parsed.nickname, animal: parsed.animal };
    }
  } catch {
    // Unreadable JSON is handled like a wrong shape below.
  }
  storage.remove('camp.profile');
  return null;
}

export function saveProfile(profile: PlayerProfile): void {
  storage.setString('camp.profile', JSON.stringify(profile));
}

/** Sheet prefill: saved nickname → signed-in username → empty; saved animal → fox. */
export function initialProfile(saved: PlayerProfile | null, username: string | undefined): PlayerProfile {
  return {
    nickname: saved?.nickname ?? username ?? '',
    animal: saved?.animal ?? DEFAULT_ANIMAL,
  };
}
