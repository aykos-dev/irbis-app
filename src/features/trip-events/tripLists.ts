import type { QueryClient } from '@tanstack/react-query';

import { getGroupTripsListQueryKey } from '../../shared/api/generated/group-trips/group-trips';
import { getSearchQueryQueryKey } from '../../shared/api/generated/search/search';

/** Refetch every trip list (Groups, Place, all trips, Search) after a trip or membership change. */
export function invalidateTripLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: getGroupTripsListQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getSearchQueryQueryKey() });
}
