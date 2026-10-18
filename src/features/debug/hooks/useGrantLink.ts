import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { DebugGrantParams } from '../../../app/navigation/types';
import { getMeGetQueryKey, getMeLevelGetQueryKey, useQaLevelsGrant } from '../../../shared/api/generated';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { toGrantBody } from '../grantLink';

function isPlaceQuery(queryKey: readonly unknown[]): boolean {
  const [head] = queryKey;
  return typeof head === 'string' && head.startsWith('/v1/places');
}

/**
 * Runs the QA level grant once per grant link (levels AC8): signed out it opens the log-in prompt
 * first. Success refreshes the level, the account and every place (their `viewer` level).
 */
export function useGrantLink(params: DebugGrantParams | undefined): void {
  const { status } = useAuth();
  const queryClient = useQueryClient();
  const requireAccount = useRequireAccount('progress');
  const { mutate } = useQaLevelsGrant({ mutation: { meta: { silentError: true } } });
  const handled = useRef<DebugGrantParams | null>(null);

  useEffect(() => {
    if (!params?.grant || status === 'loading' || handled.current === params) {
      return;
    }
    handled.current = params;
    const body = toGrantBody(params);
    const counts = {
      xp: body.xp ?? 0,
      lessons: body.lessons?.length ?? 0,
      checkIns: body.checkIns?.length ?? 0,
      spots: body.verifiedSpots ?? 0,
    };
    requireAccount(() =>
      mutate(
        { data: body },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: getMeLevelGetQueryKey() });
            void queryClient.invalidateQueries({ queryKey: getMeGetQueryKey() });
            void queryClient.invalidateQueries({ predicate: query => isPlaceQuery(query.queryKey) });
            haptics.success();
            toast.show({ variant: 'success', message: t('levels.debug.granted') });
            qaLog('level_grant', { ...counts, ok: true });
          },
          onError: () => {
            haptics.error();
            toast.show({ variant: 'error', message: t('levels.debug.grantFailed') });
            qaLog('level_grant', { ...counts, ok: false });
          },
        },
      ),
    );
  }, [params, status, requireAccount, mutate, queryClient]);
}
