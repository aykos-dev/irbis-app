import { useEffect } from 'react';

import { getPathGetQueryKey, usePathGet } from '../../../shared/api/generated';
import type { Interest, PathGetParams } from '../../../shared/api/generated/model';
import { useAuth } from '../../../shared/contexts/auth';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { qaLog } from '../../../shared/utils/qaLog';
import { pathCache } from '../pathCache';
import { tashkentMonth } from '../pathMonth';

/** `interests=lake,peak` — the API reads a comma list, not repeated or bracketed keys. */
function commaList(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const items = Array.isArray(value) ? value.map(String) : [String(value)];
      return `${encodeURIComponent(key)}=${items.map(encodeURIComponent).join(',')}`;
    })
    .join('&');
}

/**
 * This month's path (`GET /v1/path`, AC1/AC8). Guests send their onboarding interests; accounts
 * are picked server-side. Every successful load is cached for the month; offline the cached path
 * for the current Tashkent month is shown.
 */
export function usePath(readInterests: () => readonly Interest[]) {
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const guest = status !== 'signedIn';
  const interests = guest ? readInterests() : [];
  const params: PathGetParams | undefined = interests.length > 0 ? { interests: [...interests] } : undefined;

  const query = usePathGet(params, {
    query: {
      // Guest and account paths differ even with the same params.
      queryKey: [...getPathGetQueryKey(params), guest ? 'guest' : 'account'],
      enabled: status !== 'loading',
      placeholderData: isOnline ? undefined : () => pathCache.get(tashkentMonth()),
    },
    request: { paramsSerializer: { serialize: commaList } },
  });
  const { data, isPlaceholderData } = query;

  useEffect(() => {
    if (data && !isPlaceholderData) {
      pathCache.save(data);
      qaLog('path_loaded', { month: data.month, nodes: data.nodes.length, guest });
    }
  }, [data, isPlaceholderData, guest]);

  return { ...query, guest };
}
