import { useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import {
  getUsersGetBuddyRelationQueryKey,
  getUsersGetBuddySummaryQueryKey,
  useUsersGetBuddyRelation,
} from '../../../shared/api/generated/profile/profile';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { useBuddyActions } from '../hooks/useBuddyActions';

/**
 * Public profile buddy action (buddies AC5) from the buddy-relation endpoint: none → Add buddy,
 * outgoing → Requested + Cancel, incoming → Accept, buddies → "Buddies", self → nothing.
 * Guests see Add buddy, which asks them to log in.
 */
export function ProfileBuddyButton({ username }: { username: string }) {
  const queryClient = useQueryClient();
  const { status, user } = useAuth();
  const signedIn = status === 'signedIn';
  const { isOnline } = useNetworkStatus();
  const relation = useUsersGetBuddyRelation(username, { query: { retry: false } });
  const actions = useBuddyActions();

  const { data } = relation;
  if (!data || data.relation === 'self' || user?.username === username) {
    return null;
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getUsersGetBuddyRelationQueryKey(username) });
    void queryClient.invalidateQueries({ queryKey: getUsersGetBuddySummaryQueryKey(username) });
  };
  const after = (done: Promise<boolean>) => {
    void done.then(ok => ok && refresh());
  };

  if (data.relation === 'buddies') {
    return (
      <AppText testID="public-profile.buddy-status" variant="chip" tone="teal700">
        {t('buddies.profile.linked')}
      </AppText>
    );
  }
  if (data.relation === 'outgoing') {
    return (
      <View style={layout.row}>
        <AppText testID="public-profile.buddy-status" variant="chip" tone="teal700">
          {t('buddies.profile.requested')}
        </AppText>
        <AppButton
          testID="public-profile.cancel-buddy"
          label={t('buddies.mine.cancel')}
          variant="secondary"
          disabled={!isOnline || actions.busy}
          onPress={() => after(actions.cancel(data.userId))}
        />
      </View>
    );
  }
  if (data.relation === 'incoming' && data.linkId && signedIn) {
    const linkId = data.linkId;
    return (
      <AppButton
        testID="public-profile.accept-buddy"
        label={t('buddies.mine.accept')}
        loading={actions.busy}
        disabled={!isOnline}
        onPress={() => after(actions.accept(linkId))}
      />
    );
  }
  return (
    <AppButton
      testID="public-profile.add-buddy"
      label={t('buddies.profile.add')}
      loading={actions.adding}
      disabled={!isOnline}
      onPress={() => actions.add(data.userId, refresh)}
    />
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
});
