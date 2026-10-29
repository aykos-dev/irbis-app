import type { StreaksDto } from '../../shared/api/generated/model';
import type { MascotKind } from '../../shared/components/Mascot';

/**
 * Irbis in the Streak sheet (AC6): excited when today and this week are done, sleepy when the flame
 * is at risk, sad when both streaks are 0 ("worried" stands in until a sad pose exists), else default.
 */
export function streakMood({ flame, boot }: StreaksDto): MascotKind {
  if (flame.doneToday && boot.doneThisWeek) {
    return 'excited';
  }
  if (flame.atRisk) {
    return 'sleepy';
  }
  if (flame.count === 0 && boot.count === 0) {
    return 'worried';
  }
  return 'default';
}
