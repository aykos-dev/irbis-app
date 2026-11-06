import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import {
  getBuddiesListQueryKey,
  getBuddiesTripsQueryKey,
  getMeBuddySummaryQueryKey,
  useBuddiesAccept,
  useBuddiesDecline,
  useBuddiesRemove,
  useBuddiesRequest,
} from '../../../shared/api/generated/buddies/buddies';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { buddyErrorKey, hasCode } from '../errors';

const silent = { mutation: { meta: { silentError: true } } };

/** Buddy request / accept / decline / cancel / remove with toasts, haptics and cache refresh (AC4). */
export function useBuddyActions() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const requireAccount = useRequireAccount('post');
  const request = useBuddiesRequest(silent);
  const accept = useBuddiesAccept(silent);
  const decline = useBuddiesDecline(silent);
  const remove = useBuddiesRemove(silent);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getBuddiesListQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getBuddiesTripsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getMeBuddySummaryQueryKey() });
  };
  const done = (message: string) => {
    haptics.success();
    toast.show({ variant: 'success', message });
    refresh();
  };
  const fail = (error: unknown) => {
    haptics.error();
    toast.show({ variant: 'error', message: t(buddyErrorKey(error)) });
    if (hasCode(error, 'SECURED_ACCOUNT_REQUIRED')) {
      navigation.navigate('SecureAccount');
    }
  };

  /** Guests get the log-in prompt, demo accounts are sent to Secure your account. */
  const add = (userId: string, onRequested: () => void) =>
    requireAccount(() => {
      if (user?.isDemo) {
        toast.show({ variant: 'error', message: t('buddies.errors.SECURED_ACCOUNT_REQUIRED') });
        navigation.navigate('SecureAccount');
        return;
      }
      request.mutateAsync({ data: { userId } }).then(
        link => {
          onRequested();
          done(t(link.status === 'accepted' ? 'buddies.toast.accepted' : 'buddies.toast.requested'));
        },
        fail,
      );
    });

  const run = async (action: () => Promise<unknown>, message: string): Promise<boolean> => {
    try {
      await action();
      done(message);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  };

  return {
    add,
    adding: request.isPending,
    accept: (id: string) => run(() => accept.mutateAsync({ id }), t('buddies.toast.accepted')),
    decline: (id: string) => run(() => decline.mutateAsync({ id }), t('buddies.toast.declined')),
    cancel: (userId: string) => run(() => remove.mutateAsync({ userId }), t('buddies.toast.cancelled')),
    remove: (userId: string) => run(() => remove.mutateAsync({ userId }), t('buddies.toast.removed')),
    removing: remove.isPending,
    busy: accept.isPending || decline.isPending || remove.isPending,
  };
}
