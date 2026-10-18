import type {
  ConditionReasonDto,
  ConditionStatus,
  PlaceConditionDto,
} from '../../api/generated/model';
import { t, type Locale } from '../../i18n';
import type { StatusChipVariant } from '../StatusChip';

const MAX_REASONS = 3;
const MS_PER_MIN = 60_000;
const MIN_PER_H = 60;
const H_PER_D = 24;
const TIME_ZONE = 'Asia/Tashkent';

/** Codes that carry admin text instead of a template (source closure / manual). */
const TEXT_CODES = new Set<string>(['OVERRIDE', 'CLOSURE']);

export const statusVariant: Record<ConditionStatus, StatusChipVariant> = {
  go: 'go',
  caution: 'caution',
  not_now: 'notNow',
  seasonal_lock: 'seasonalLock',
};

function formatValue(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** One forecast / hazard reason in the locale (AC7); null for codes that carry admin text. */
export function reasonText(reason: ConditionReasonDto, locale: Locale): string | null {
  if (TEXT_CODES.has(reason.code)) {
    return null;
  }
  return t(`conditions.reason.${reason.code}`, {
    locale,
    day: reason.day ? t(`conditions.day.${reason.day}`, { locale }) : '',
    value: reason.value === undefined ? '' : formatValue(reason.value, locale),
  });
}

/**
 * The card's reason lines (AC7): closure / manual show the admin text (locale → uz) as the single
 * line; otherwise up to three template lines, worst first as the API sends them.
 */
export function conditionLines(condition: PlaceConditionDto, locale: Locale): string[] {
  if (condition.source === 'closure' || condition.source === 'manual') {
    const text = condition.text ? condition.text[locale] ?? condition.text.uz : null;
    return text ? [text] : [];
  }
  return condition.reasons
    .map(reason => reasonText(reason, locale))
    .filter((line): line is string => line !== null)
    .slice(0, MAX_REASONS);
}

/** "just now" under a minute, then minutes, hours, days. */
export function updatedAgo(computedAt: string, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(computedAt)) / MS_PER_MIN));
  if (minutes < 1) {
    return t('conditions.ago.now');
  }
  if (minutes < MIN_PER_H) {
    return t('conditions.ago.min', { n: minutes });
  }
  const hours = Math.floor(minutes / MIN_PER_H);
  if (hours < H_PER_D) {
    return t('conditions.ago.h', { n: hours });
  }
  return t('conditions.ago.d', { n: Math.floor(hours / H_PER_D) });
}

/** Whole minutes since `computedAt`, for the QA event; null when never computed. */
export function ageMinutes(computedAt: string | null, now: Date): number | null {
  if (!computedAt) {
    return null;
  }
  return Math.max(0, Math.floor((now.getTime() - Date.parse(computedAt)) / MS_PER_MIN));
}

/** Full month name in the locale for a 1-based month (Tashkent calendar). */
function monthName(month: number, locale: Locale): string {
  const date = new Date(Date.UTC(2000, month - 1, 15));
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: TIME_ZONE }).format(date);
}

export function conditionTitle(
  status: ConditionStatus,
  opensMonth: number | null,
  locale: Locale,
): string {
  if (status === 'seasonal_lock') {
    return opensMonth
      ? t('conditions.title.seasonalOpens', { month: monthName(opensMonth, locale) })
      : t('conditions.title.seasonal');
  }
  return t(`conditions.title.${status}`);
}
