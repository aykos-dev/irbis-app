import { useEffect } from 'react';

import { useLevelsList } from '../../../shared/api/generated';
import type { LevelListResponseDto } from '../../../shared/api/generated/model';
import { staleTimes } from '../../../shared/api/query';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { storage } from '../../../shared/storage';
import { qaLog } from '../../../shared/utils/qaLog';

function isLevelList(value: unknown): value is LevelListResponseDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'items' in value &&
    Array.isArray(value.items)
  );
}

/** The saved table, or none when it is missing or unreadable (then it is dropped). */
function savedDefs(): LevelListResponseDto | undefined {
  const raw = storage.getString('levels.defs');
  if (raw === undefined) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isLevelList(parsed)) {
      return parsed;
    }
  } catch {
    // Unreadable JSON is handled like a wrong shape below.
  }
  storage.remove('levels.defs');
  qaLog('levels_saved_invalid', { key: 'levels.defs' });
  return undefined;
}

/**
 * The public level table (`GET /v1/levels`). Offline it falls back to the last saved table
 * (MMKV `levels.defs`), so Level and Companions still open (AC5, AC6).
 */
export function useLevelDefs({ enabled = true }: { enabled?: boolean } = {}) {
  const { isOnline } = useNetworkStatus();
  const query = useLevelsList({
    query: {
      enabled,
      staleTime: staleTimes.reference,
      placeholderData: isOnline ? undefined : savedDefs,
    },
  });
  const { data, isPlaceholderData } = query;

  useEffect(() => {
    if (data && !isPlaceholderData) {
      storage.setString('levels.defs', JSON.stringify(data));
    }
  }, [data, isPlaceholderData]);

  return query;
}
