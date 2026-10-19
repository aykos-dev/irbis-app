import type { MafiaWinner } from '../../protocol/codec';
import type { RoleId } from './roles';

export type MafiaWinningTeam = Exclude<MafiaWinner, 'none'>;

const mafiaRoles: readonly RoleId[] = ['boss', 'mafia'];

/**
 * The team that has won once `out` seats are gone (AC6), checked in order: the maniac among the
 * last two; no mafia and no maniac left → town; mafia equal to or above everyone else → mafia.
 */
export function winCheck(
  roles: Readonly<Record<string, RoleId>>,
  out: readonly string[],
): MafiaWinningTeam | null {
  const alive = Object.entries(roles)
    .filter(([seatId]) => !out.includes(seatId))
    .map(([, roleId]) => roleId);
  const maniacAlive = alive.includes('maniac');
  const mafiaAlive = alive.filter(roleId => mafiaRoles.includes(roleId)).length;
  if (maniacAlive && alive.length <= 2) {
    return 'maniac';
  }
  if (mafiaAlive === 0 && !maniacAlive) {
    return 'town';
  }
  if (mafiaAlive >= alive.length - mafiaAlive) {
    return 'mafia';
  }
  return null;
}

/** The roles of the dealt seats (host excluded) from the host's deals. */
export function dealtRoles(
  players: readonly string[],
  deals: Readonly<Record<string, { roleId: RoleId }>>,
): Record<string, RoleId> {
  const roles: Record<string, RoleId> = {};
  players.forEach(seatId => {
    const roleId = deals[seatId]?.roleId;
    if (roleId) {
      roles[seatId] = roleId;
    }
  });
  return roles;
}
