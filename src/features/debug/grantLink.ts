import type { DebugGrantParams } from '../../app/navigation/types';
import type { QaGrantDto } from '../../shared/api/generated/model';

/** `irbis://debug/levels/grant?…` (levels AC8, QA builds only). */
export const DEBUG_GRANT = /^\/?debug\/levels\/grant\/?(?:\?([^#]*))?(?:#.*)?$/;

const DEFAULT_TIER = '1';
const DEFAULT_DIFFICULTY = 1;
const COUNT_KEYS = ['xp', 'lessons', 'checkins', 'difficulty', 'spots'] as const;

/** A non-negative whole number, or nothing for anything else ("", "2.5", "-1", "abc"). */
function toCount(raw: string | undefined): number | undefined {
  if (raw === undefined || !/^\d+$/.test(raw)) {
    return undefined;
  }
  return Number(raw);
}

/** Query string → grant params; unknown keys and unreadable values are ignored. */
export function parseGrantQuery(query: string): DebugGrantParams {
  const values = new Map<string, string>();
  query
    .split('&')
    .filter(Boolean)
    .forEach(pair => {
      const [key = '', value = ''] = pair.split('=');
      values.set(decodeURIComponent(key), decodeURIComponent(value));
    });
  const params: DebugGrantParams = { grant: true };
  COUNT_KEYS.forEach(key => {
    const count = toCount(values.get(key));
    if (count !== undefined) {
      params[key] = count;
    }
  });
  const tier = values.get('tier');
  if (tier) {
    params.tier = tier;
  }
  return params;
}

/**
 * Grant params → `POST /v1/qa/levels/grant` body: `lessons=N` gives N lessons of `tier` (default
 * "1"), `checkins=N` gives N check-ins at `difficulty` (default 1).
 */
export function toGrantBody(params: DebugGrantParams): QaGrantDto {
  const body: QaGrantDto = {};
  if (params.xp) {
    body.xp = params.xp;
  }
  if (params.lessons) {
    const tier = params.tier ?? DEFAULT_TIER;
    body.lessons = Array.from({ length: params.lessons }, () => ({ tier }));
  }
  if (params.checkins) {
    const difficulty = params.difficulty || DEFAULT_DIFFICULTY;
    body.checkIns = Array.from({ length: params.checkins }, () => ({ difficulty }));
  }
  if (params.spots !== undefined) {
    body.verifiedSpots = params.spots;
  }
  return body;
}
