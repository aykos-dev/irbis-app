import type { LevelDefDto } from '../../shared/api/generated/model';
import { MIN_LEVEL } from '../../shared/components/levels/levelMeta';
import { t, type Locale } from '../../shared/i18n';
import { formatNumber } from '../../shared/utils/format';

/** Lesson tier key the API uses for the first-aid tier. */
export const FIRST_AID_TIER = 'first-aid';

type LessonGate = Pick<LevelDefDto['lessons'], 'kind' | 'tier'>;

/** Short lessons phrase for the Companions line (AC6). */
function lessonsPhrase(lessons: LevelDefDto['lessons']): string {
  if (lessons.kind === 'all') {
    return t('levels.fmt.lessonsAll');
  }
  if (lessons.kind === 'tier' && lessons.tier !== null) {
    return lessons.tier === FIRST_AID_TIER
      ? t('levels.fmt.lessonsFirstAid')
      : t('levels.fmt.lessonsTier', { tier: lessons.tier });
  }
  return t('levels.fmt.lessonsCount', { count: lessons.required });
}

/** Requirement row label for the Level screen (AC5). */
export function lessonsLabel(lessons: LessonGate): string {
  if (lessons.kind === 'all') {
    return t('levels.req.lessonsAll');
  }
  if (lessons.kind === 'tier' && lessons.tier !== null) {
    return lessons.tier === FIRST_AID_TIER
      ? t('levels.req.lessonsFirstAid')
      : t('levels.req.lessonsTier', { tier: lessons.tier });
  }
  return t('levels.req.lessonsCount');
}

/**
 * One level's requirements as a line (AC6), e.g. "1,000 XP · Tier 2 lessons · 5 check-ins at
 * difficulty 2+". Level 1 has none: "Where every explorer starts."
 */
export function formatRequirement(def: LevelDefDto, locale: Locale): string {
  if (def.level <= MIN_LEVEL) {
    return t('levels.companions.start');
  }
  const { checkIns } = def;
  const parts = [
    t('levels.fmt.xp', { xp: formatNumber(def.xp, locale) }),
    lessonsPhrase(def.lessons),
    checkIns.minDifficulty > 1
      ? t('levels.fmt.checkInsAt', { count: checkIns.required, d: checkIns.minDifficulty })
      : t('levels.fmt.checkIns', { count: checkIns.required }),
  ];
  if (def.verifiedSpots > 0) {
    parts.push(t('levels.fmt.spots', { count: def.verifiedSpots }));
  }
  return parts.join(t('levels.fmt.join'));
}
