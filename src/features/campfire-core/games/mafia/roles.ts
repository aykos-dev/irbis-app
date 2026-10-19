import { z } from 'zod';

import { storage } from '../../../../shared/storage';
import { mafiaRoleColors } from '../../campTheme';
import { shuffle, type Rng } from '../usedStore';

/** Stable role ids (wire + tests), in setup order. */
export const roleIds = [
  'boss',
  'mafia',
  'detective',
  'doctor',
  'maniac',
  'lover',
  'bodyguard',
  'sniper',
  'journalist',
  'immortal',
  'civilian',
] as const;
export type RoleId = (typeof roleIds)[number];

/** Every role but Civilian: the host sets their counts; civilians fill the rest. */
export const specialRoleIds = roleIds.filter(
  (id): id is Exclude<RoleId, 'civilian'> => id !== 'civilian',
);
export type SpecialRoleId = Exclude<RoleId, 'civilian'>;

export type Team = 'town' | 'mafia' | 'solo';
export type RoleGlyphName =
  | 'crown'
  | 'hat'
  | 'glass'
  | 'cross'
  | 'moon'
  | 'heart'
  | 'shield'
  | 'crosshair'
  | 'notepad'
  | 'infinity'
  | 'person';

export type Role = {
  id: RoleId;
  team: Team;
  color: string;
  glyph: RoleGlyphName;
};

/** The role table (spec, campfire-mafia-roles-copy.md). */
export const roles: readonly Role[] = [
  { id: 'boss', team: 'mafia', color: mafiaRoleColors.boss, glyph: 'crown' },
  { id: 'mafia', team: 'mafia', color: mafiaRoleColors.mafia, glyph: 'hat' },
  { id: 'detective', team: 'town', color: mafiaRoleColors.detective, glyph: 'glass' },
  { id: 'doctor', team: 'town', color: mafiaRoleColors.doctor, glyph: 'cross' },
  { id: 'maniac', team: 'solo', color: mafiaRoleColors.maniac, glyph: 'moon' },
  { id: 'lover', team: 'town', color: mafiaRoleColors.lover, glyph: 'heart' },
  { id: 'bodyguard', team: 'town', color: mafiaRoleColors.bodyguard, glyph: 'shield' },
  { id: 'sniper', team: 'town', color: mafiaRoleColors.sniper, glyph: 'crosshair' },
  { id: 'journalist', team: 'town', color: mafiaRoleColors.journalist, glyph: 'notepad' },
  { id: 'immortal', team: 'town', color: mafiaRoleColors.immortal, glyph: 'infinity' },
  { id: 'civilian', team: 'town', color: mafiaRoleColors.civilian, glyph: 'person' },
];

export function teamOf(id: RoleId): Team {
  return roles.find(role => role.id === id)?.team ?? 'town';
}

/** Players besides the host needed to deal. */
export const MAFIA_MIN_PLAYERS = 5;
/** Room size for Mafia, host included. */
export const mafiaRange = { min: MAFIA_MIN_PLAYERS + 1, max: 15 } as const;

const count = z.number().int().min(0);
export const mafiaCountsSchema = z.object({
  boss: count,
  mafia: count,
  detective: count,
  doctor: count,
  maniac: count,
  lover: count,
  bodyguard: count,
  sniper: count,
  journalist: count,
  immortal: count,
});
export type MafiaCounts = z.infer<typeof mafiaCountsSchema>;

export const mafiaSettingsSchema = z.object({
  counts: mafiaCountsSchema,
  revealOut: z.boolean(),
});
export type MafiaSettings = z.infer<typeof mafiaSettingsSchema>;

/** A fresh host's counts for `n` players (host excluded). */
export function defaultCounts(n: number): MafiaCounts {
  return {
    boss: 1,
    mafia: Math.max(0, Math.floor(n / 3) - 1),
    detective: 1,
    doctor: 1,
    maniac: 0,
    lover: 0,
    bodyguard: 0,
    sniper: 0,
    journalist: 0,
    immortal: 0,
  };
}

/** Every count kept within 0..n. */
export function clampCounts(counts: MafiaCounts, n: number): MafiaCounts {
  const clamped = { ...counts };
  specialRoleIds.forEach(id => {
    clamped[id] = Math.min(Math.max(0, counts[id]), Math.max(0, n));
  });
  return clamped;
}

export function specials(counts: MafiaCounts): number {
  return specialRoleIds.reduce((sum, id) => sum + counts[id], 0);
}

/** Civilians fill the seats the specials leave (never below 0). */
export function civilians(counts: MafiaCounts, n: number): number {
  return Math.max(0, n - specials(counts));
}

export type Balance = 'balanced' | 'townHeavy' | 'mafiaHeavy';

/** Hint only: mafia (boss included) against a quarter to a third of the table. */
export function balance(counts: MafiaCounts, n: number): Balance {
  const m = counts.boss + counts.mafia;
  const lo = Math.max(1, Math.floor(n / 4));
  const hi = Math.max(1, Math.floor(n / 3));
  if (m < lo) {
    return 'townHeavy';
  }
  return m > hi ? 'mafiaHeavy' : 'balanced';
}

export function teamCounts(
  counts: MafiaCounts,
  n: number,
): Record<Team, number> {
  const totals: Record<Team, number> = { town: civilians(counts, n), mafia: 0, solo: 0 };
  specialRoleIds.forEach(id => {
    totals[teamOf(id)] += counts[id];
  });
  return totals;
}

export type DealBlock = 'needPlayers' | 'tooMany' | 'needMafia';

/** The first reason "Deal roles" is disabled, or null. */
export function dealBlocked(counts: MafiaCounts, n: number): DealBlock | null {
  if (n < MAFIA_MIN_PLAYERS) {
    return 'needPlayers';
  }
  if (specials(counts) > n) {
    return 'tooMany';
  }
  return counts.boss + counts.mafia === 0 ? 'needMafia' : null;
}

/** One role per seat: specials in table order plus civilians, Fisher–Yates over the seats. */
export function dealRoles(
  counts: MafiaCounts,
  seatIds: readonly string[],
  rng: Rng,
): Record<string, RoleId> {
  const list: RoleId[] = specialRoleIds.flatMap(id =>
    Array.from({ length: counts[id] }, () => id),
  );
  while (list.length < seatIds.length) {
    list.push('civilian');
  }
  const deals: Record<string, RoleId> = {};
  shuffle(seatIds, rng).forEach((seatId, i) => {
    deals[seatId] = list[i] ?? 'civilian';
  });
  return deals;
}

/** The host's last setup (counts + reveal toggle), or null on a fresh phone. */
export function readMafiaSettings(): MafiaSettings | null {
  const raw = storage.getString('camp.maf.setup');
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const result = mafiaSettingsSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function saveMafiaSettings(settings: MafiaSettings): void {
  storage.setString('camp.maf.setup', JSON.stringify(settings));
}
