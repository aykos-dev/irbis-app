import { hashKey, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getPlacesListQueryKey, usePlacesList } from '../../../shared/api/generated';
import {
  PlaceOrigin,
  type PlaceListResponseDto,
  type PlacesListParams,
} from '../../../shared/api/generated/model';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { storage } from '../../../shared/storage';
import { qaLog } from '../../../shared/utils/qaLog';
import { EXPLORE_LIMIT, toListParams, type ExploreFilters } from '../exploreFilters';
import type { Coords } from './useOrigin';

/** `types=peak&types=lake` — the API accepts a repeated key, not `types[]`. */
const REPEAT_KEYS = { paramsSerializer: { indexes: null } } as const;

/** Filters and limit of a list query, without the origin (lat/lng). */
function withoutOrigin(params: PlacesListParams | undefined): string {
  const { lat: _lat, lng: _lng, ...rest } = params ?? {};
  return hashKey([rest]);
}

/**
 * Offline (AC8): the newest cached list for the same filters, whatever origin it was loaded from,
 * so a changed origin (e.g. a location fix arriving while offline) still shows the last list.
 */
function lastCachedList(client: QueryClient, params: PlacesListParams): PlaceListResponseDto | undefined {
  const wanted = withoutOrigin(params);
  const newest = client
    .getQueryCache()
    .findAll({ queryKey: getPlacesListQueryKey() })
    .filter(cached => cached.state.data !== undefined)
    .filter(cached => withoutOrigin(cached.queryKey[1] as PlacesListParams | undefined) === wanted)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0];
  return newest?.state.data as PlaceListResponseDto | undefined;
}

type SavedList = { filters: string; data: PlaceListResponseDto };

/** Keeps the last loaded list on the device, so an offline restart still has it (Q11). */
function saveList(filters: string, data: PlaceListResponseDto): void {
  const saved: SavedList = { filters, data };
  storage.setString('explore.lastList', JSON.stringify(saved));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Shape check of the stored value: anything else (an older payload, a broken write) is dropped. */
function isSavedList(value: unknown): value is SavedList {
  if (!isRecord(value) || typeof value.filters !== 'string' || !isRecord(value.data)) {
    return false;
  }
  const { items, origin } = value.data;
  return Array.isArray(items) && Object.values<unknown>(PlaceOrigin).includes(origin);
}

/** Forgets an unreadable saved list, so the next successful load rewrites it. */
function dropSavedList(reason: 'invalid_json' | 'invalid_shape'): undefined {
  storage.remove('explore.lastList');
  qaLog('explore_saved_list_invalid', { reason });
  return undefined;
}

/** The saved list when it was loaded with the same filters; an unreadable one counts as none. */
function savedList(params: PlacesListParams): PlaceListResponseDto | undefined {
  const raw = storage.getString('explore.lastList');
  if (raw === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return dropSavedList('invalid_json');
  }
  if (!isSavedList(parsed)) {
    return dropSavedList('invalid_shape');
  }
  return parsed.filters === withoutOrigin(params) ? parsed.data : undefined;
}

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
  const client = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const params = { ...coords, ...toListParams(filters), limit: EXPLORE_LIMIT };
  const query = usePlacesList(params, {
    query: {
      enabled: originReady,
      placeholderData: isOnline
        ? undefined
        : () => lastCachedList(client, params) ?? savedList(params),
    },
    request: REPEAT_KEYS,
  });
  const { data, dataUpdatedAt, isPlaceholderData } = query;
  const filtersKey = withoutOrigin(params);
  const loggedAt = useRef(0);
  const loggedApply = useRef(0);

  useEffect(() => {
    if (!data || isPlaceholderData || dataUpdatedAt === loggedAt.current) {
      return;
    }
    loggedAt.current = dataUpdatedAt;
    saveList(filtersKey, data);
    qaLog('explore_loaded', {
      count: data.total,
      origin: data.origin,
      withStatus: data.items.filter(item => (item.conditionStatus ?? null) !== null).length,
    });
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
  }, [data, dataUpdatedAt, isPlaceholderData, appliedAt, filters, filtersKey]);

  return query;
}
