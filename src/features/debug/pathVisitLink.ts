import type { DebugPathVisitParams } from '../../app/navigation/types';

/** `irbis://debug/path/visit/<placeId>` (weekly-path AC4, QA builds only). */
const DEBUG_PATH_VISIT = /^\/?debug\/path\/visit\/([^/?#]+)\/?(?:[?#].*)?$/;

/** Link path → Debug params for a QA path visit, or null when it is not a visit link. */
export function parsePathVisitLink(path: string): DebugPathVisitParams | null {
  const match = DEBUG_PATH_VISIT.exec(path);
  return match?.[1] ? { pathVisit: decodeURIComponent(match[1]) } : null;
}
