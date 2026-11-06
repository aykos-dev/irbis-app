import { keepPreviousData } from '@tanstack/react-query';

import { useGetTripPreview } from '../../../shared/api/generated/trips/trips';
import { useDebounce } from '../../../shared/hooks/useDebounce';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Sunset, daylight buffer and gear for the window (AC3, AC5), debounced while the times change.
 * Only asked for a window that passes the inline check. A group-linked plan passes its
 * `groupTripId`, so the gear merges the group trip's keys and custom items (trip-events AC6).
 */
export function useTripPreview(
  placeId: string,
  startAt: string,
  backBy: string,
  valid: boolean,
  groupTripId: string | null = null,
) {
  const params = useDebounce(valid ? `${startAt}|${backBy}` : null, PREVIEW_DEBOUNCE_MS);
  const [debouncedStart = '', debouncedBack = ''] = params ? params.split('|') : [];
  return useGetTripPreview(
    placeId,
    { startAt: debouncedStart, backBy: debouncedBack, ...(groupTripId ? { groupTripId } : {}) },
    { query: { enabled: params !== null, placeholderData: keepPreviousData } },
  );
}
