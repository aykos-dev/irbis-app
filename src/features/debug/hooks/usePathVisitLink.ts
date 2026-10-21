import { useQueryClient, type Query } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { DebugPathVisitParams } from '../../../app/navigation/types';
import { getPathGetQueryKey, useQaPathVisit } from '../../../shared/api/generated';
import { errorMessageKey } from '../../../shared/api/errors';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';

const [PATH_KEY] = getPathGetQueryKey();

/** The signed-in user's path queries (the Path tab tags guest and account keys). */
function isAccountPath(query: Query): boolean {
  const key = query.queryKey;
  return key[0] === PATH_KEY && key[key.length - 1] === 'account';
}

/**
 * Runs the QA path visit once per visit link (weekly-path AC4): signed out it opens the log-in
 * prompt first. The response is the updated path, written straight into the Path tab's cache.
 */
export function usePathVisitLink(params: DebugPathVisitParams | undefined): void {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const requireAccount = useRequireAccount('progress');
  const { mutate } = useQaPathVisit({ mutation: { meta: { silentError: true } } });
  const handled = useRef<DebugPathVisitParams | null>(null);

  useEffect(() => {
    if (!params || status === 'loading' || handled.current === params) {
      return;
    }
    handled.current = params;
    const placeId = params.pathVisit;
    requireAccount(() =>
      mutate(
        { data: { placeId } },
        {
          onSuccess: path => {
            queryClient.setQueriesData({ predicate: isAccountPath }, path);
            haptics.success();
            qaLog('path_visit_debug', { placeId });
          },
          onError: error => {
            haptics.error();
            toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
          },
        },
      ),
    );
  }, [params, status, requireAccount, mutate, queryClient]);
}
