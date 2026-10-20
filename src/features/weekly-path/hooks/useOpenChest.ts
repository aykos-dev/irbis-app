import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getMeLevelGetQueryKey, getPathGetQueryKey, usePathOpenChest } from '../../../shared/api/generated';
import type { PathChestDto, PathChestOpenDto } from '../../../shared/api/generated/model';
import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import { toast } from '../../../shared/components/toastBus';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';

const LOCKED = 409;

type Options = {
  chest: PathChestDto;
  month: string;
  /** Not every place checked in yet: shake the chest. */
  onLocked: () => void;
  /** The server opened it: play the lid. */
  onOpened: (result: PathChestOpenDto) => void;
};

/**
 * Tap on the monthly chest (AC5). Guests get the log-in prompt first. Locked → toast; full →
 * `POST /v1/path/chest/open`, reward toast, and a refetch of the path and the level (pending
 * level-ups then open LevelUp through the app shell's level-up queue, like every other XP award).
 */
export function useOpenChest({ chest, month, onLocked, onOpened }: Options): { press: () => void; pending: boolean } {
  const queryClient = useQueryClient();
  const requireAccount = useRequireAccount('xp');
  const { mutate, isPending } = usePathOpenChest({ mutation: { meta: { silentError: true } } });
  // The action may resume after sign-in, so it reads the latest chest, not the one tapped.
  const latest = useRef(chest);
  useEffect(() => {
    latest.current = chest;
  }, [chest]);

  const refreshPath = () => queryClient.invalidateQueries({ queryKey: getPathGetQueryKey() });

  const showLocked = () => {
    haptics.warning();
    onLocked();
    toast.show({ variant: 'info', message: t('path.chest.locked', { required: latest.current.required }) });
  };

  const open = () => {
    const current = latest.current;
    if (current.opened || isPending) {
      return;
    }
    if (current.done < current.required) {
      showLocked();
      return;
    }
    mutate(undefined, {
      onSuccess: result => {
        haptics.heavy();
        onOpened(result);
        toast.show({ variant: 'success', message: t('path.chest.reward', { xp: result.xp }) });
        qaLog('path_chest_opened', { month, xp: result.xp });
        void refreshPath();
        void queryClient.invalidateQueries({ queryKey: getMeLevelGetQueryKey() });
      },
      onError: error => {
        if (isApiError(error) && error.status === LOCKED) {
          void refreshPath();
          showLocked();
          return;
        }
        haptics.error();
        toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
      },
    });
  };

  return { press: () => requireAccount(open), pending: isPending };
}
