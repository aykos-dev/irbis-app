import { keepPreviousData } from '@tanstack/react-query';

import { useGetTripPreview } from '../../../shared/api/generated/trips/trips';
import { useDebounce } from '../../../shared/hooks/useDebounce';

const PREVIEW_DEBOUNCE_MS = 400;

/**
 * Sunset, daylight buffer and gear for the window (AC3, AC5), debounced while the times change.
 * Only asked for a window that passes the inline check.
 */
export function useTripPreview(placeId: string, startAt: string, backBy: string, valid: boolean) {
  const params = useDebounce(valid ? `${startAt}|${backBy}` : null, PREVIEW_DEBOUNCE_MS);
  const [debouncedStart = '', debouncedBack = ''] = params ? params.split('|') : [];
  return useGetTripPreview(
    placeId,
    { startAt: debouncedStart, backBy: debouncedBack },
    { query: { enabled: params !== null, placeholderData: keepPreviousData } },
  );
}
