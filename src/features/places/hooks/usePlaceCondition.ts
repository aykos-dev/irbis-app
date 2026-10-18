import { useEffect, useRef } from 'react';

import { useConditionsGetForPlace } from '../../../shared/api/generated';
import { ageMinutes } from '../../../shared/components/conditions/reasonText';
import { qaLog } from '../../../shared/utils/qaLog';

/**
 * A place's weekend condition (AC7, AC8) via the generated hook. Cached data stays readable
 * offline. Logs `condition_viewed` once per open, as soon as both the condition and the place's
 * slug are known.
 */
export function usePlaceCondition(id: string, slug: string | undefined) {
  const query = useConditionsGetForPlace(id);
  const logged = useRef(false);
  const { data } = query;

  useEffect(() => {
    if (!data || !slug || logged.current) {
      return;
    }
    logged.current = true;
    qaLog('condition_viewed', {
      slug,
      status: data.status,
      source: data.source,
      ageMin: ageMinutes(data.computedAt, new Date()),
    });
  }, [data, slug]);

  return query;
}
