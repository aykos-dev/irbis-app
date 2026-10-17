import { useEffect, useRef } from 'react';

import { usePlacesGet } from '../../../shared/api/generated';
import type { PlacesGetParams } from '../../../shared/api/generated/model';
import { qaLog } from '../../../shared/utils/qaLog';

/** API code for an unknown or unpublished place (places-1-irbis-api). */
const PLACE_NOT_FOUND = 'PLACE_NOT_FOUND';

/**
 * One place (AC7) via the generated hook. Coordinates come from navigation when Explore has them;
 * without them the API measures from Tashkent. Logs `place_viewed` once per successful load.
 */
export function usePlace(id: string, coords: PlacesGetParams | undefined) {
  const query = usePlacesGet(id, coords);
  const logged = useRef<string | null>(null);
  const { data } = query;

  useEffect(() => {
    if (data && logged.current !== data.id) {
      logged.current = data.id;
      qaLog('place_viewed', {
        slug: data.slug,
        requiredLevel: data.requiredLevel,
        qualifies: data.viewer.qualifies,
      });
    }
  }, [data]);

  return { ...query, isNotFound: query.error?.code === PLACE_NOT_FOUND };
}
