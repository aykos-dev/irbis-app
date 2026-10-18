import type { PendingLevelUpDto } from '../../shared/api/generated/model';

/**
 * In-memory level-up bookkeeping for one app session (AC7). `shown`: a LevelUp was opened for
 * the id, so it never opens twice this session. `continued`: the user pressed Continue, so its
 * `seen` call is retried on every refetch while the server still lists it as pending.
 */
const shown = new Set<string>();
const continued = new Set<string>();

export const levelUpSession = {
  /** A fresh session (the app shell mounted). */
  reset(): void {
    shown.clear();
    continued.clear();
  },
  markShown(id: string): void {
    shown.add(id);
  },
  markContinued(id: string): void {
    continued.add(id);
  },
  isContinued(id: string): boolean {
    return continued.has(id);
  },
  /** The oldest pending level-up not yet shown this session (the API lists oldest first). */
  next(pending: readonly PendingLevelUpDto[]): PendingLevelUpDto | undefined {
    return pending.find(item => !shown.has(item.id));
  },
};
