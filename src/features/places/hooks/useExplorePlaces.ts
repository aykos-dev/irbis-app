import { useEffect, useRef } from 'react';

import { usePlacesList } from '../../../shared/api/generated';
import { qaLog } from '../../../shared/utils/qaLog';
import { EXPLORE_LIMIT, toListParams, type ExploreFilters } from '../exploreFilters';
import type { Coords } from './useOrigin';

/** `types=peak&types=lake` — the API accepts a repeated key, not `types[]`. */
const REPEAT_KEYS = { paramsSerializer: { indexes: null } } as const;

/**
 * Explore's one list query (AC4, AC5): map and list share it, so a filter change refetches both
 * together. Waits until the origin is settled so it never loads twice on open. Logs
 * `explore_loaded` per successful load and `explore_filters_applied` for loads after "Show places".
 */
export function useExplorePlaces(
  filters: ExploreFilters,
  coords: Coords | undefined,
  originReady: boolean,
  appliedAt: number,
) {
  const query = usePlacesList(
    { ...coords, ...toListParams(filters), limit: EXPLORE_LIMIT },
    { query: { enabled: originReady }, request: REPEAT_KEYS },
  );
  const { data, dataUpdatedAt } = query;
  const loggedAt = useRef(0);
  const loggedApply = useRef(0);

  useEffect(() => {
    if (!data || dataUpdatedAt === loggedAt.current) {
      return;
    }
    loggedAt.current = dataUpdatedAt;
    qaLog('explore_loaded', { count: data.total, origin: data.origin });
    if (appliedAt > loggedApply.current) {
      loggedApply.current = appliedAt;
      qaLog('explore_filters_applied', {
        types: filters.types.join(','),
        difficultyMin: filters.difficulty?.min ?? null,
        difficultyMax: filters.difficulty?.max ?? null,
        maxKm: filters.maxKm,
        count: data.total,
      });
    }
  }, [data, dataUpdatedAt, appliedAt, filters]);

  return query;
}
