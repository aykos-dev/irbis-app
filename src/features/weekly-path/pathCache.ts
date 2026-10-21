import type { PathDto } from '../../shared/api/generated/model';
import { storage } from '../../shared/storage';
import { qaLog } from '../../shared/utils/qaLog';

function isPath(value: unknown): value is PathDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'month' in value &&
    typeof value.month === 'string' &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'weather' in value
  );
}

/**
 * The last successful path per Tashkent month (MMKV `path.cache.<YYYY-MM>`, guests too), so the
 * Path tab opens offline (AC8). Places and weather only, no personal data.
 */
export const pathCache = {
  save(data: PathDto): void {
    storage.setString(`path.cache.${data.month}`, JSON.stringify(data));
  },

  get(month: string): PathDto | undefined {
    const key = `path.cache.${month}` as const;
    const raw = storage.getString(key);
    if (raw === undefined) {
      return undefined;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isPath(parsed)) {
        return parsed;
      }
    } catch {
      // Unreadable JSON is dropped like a wrong shape below.
    }
    storage.remove(key);
    qaLog('path_saved_invalid', { key });
    return undefined;
  },
};
