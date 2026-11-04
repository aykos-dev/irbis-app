import { useQueryClient } from '@tanstack/react-query';
import { Alert, StyleSheet, View } from 'react-native';
import { useState } from 'react';

import {
  getGroupsGetQueryKey,
  getGroupsListQueryKey,
  useGroupsApproveRequest,
  useGroupsDelete,
  useGroupsGet,
  useGroupsInvite,
  useGroupsJoin,
  useGroupsLeave,
  useGroupsRejectRequest,
  useGroupsRemoveMember,
  useGroupsSetAdmin,
  useGroupsTransferOwnership,
} from '../../../shared/api/generated/groups/groups';
import type { GroupMemberDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import type { RootStackScreenProps } from '../../../app/navigation/types';
import { useGuestSession } from '../../../shared/auth/useGuestSession';

export function GroupDetailsScreen({ navigation, route }: RootStackScreenProps<'GroupDetails'>) {
  const { colors } = useTheme();
  const styles = useStyles();
  const auth = useAuth();
  const session = useGuestSession('group_join');
  const client = useQueryClient();
  const group = useGroupsGet(route.params.id);
  const [username, setUsername] = useState('');
  const join = useGroupsJoin();
  const leave = useGroupsLeave();
  const invite = useGroupsInvite();
  const approve = useGroupsApproveRequest();
  const reject = useGroupsRejectRequest();
  const setAdmin = useGroupsSetAdmin();
  const remove = useGroupsRemoveMember();
  const transfer = useGroupsTransferOwnership();
  const removeGroup = useGroupsDelete();

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGroupsGetQueryKey(route.params.id) }),
      client.invalidateQueries({ queryKey: getGroupsListQueryKey() }),
    ]);
  };
  const run = async (action: Promise<unknown>, success?: string) => {
    try {
      await action;
      await refresh();
      if (success) toast.show({ variant: 'success', message: success });
    } catch {
      toast.show({ variant: 'error', message: t('groups.failed') });
    }
  };

  if (group.isError || (!group.isLoading && !group.data)) {
    return (
      <Screen testID="group-details.screen">
        <ErrorState testID="group-details.error" retryTestID="group-details.retry" error={group.error} onRetry={() => void group.refetch()} />
      </Screen>
    );
  }
  if (!group.data) return <Screen testID="group-details.loading"><AppText>{t('common.loading')}</AppText></Screen>;

  const data = group.data;
  const membership = data.viewerMembership;
  const active = membership?.status === 'active';
  const admin = active && membership.role !== 'member';
  const owner = active && membership.role === 'owner';

  const joinNow = async () => {
    try {
      await session.ensure();
      await run(join.mutateAsync({ id: data.id }), t(data.visibility === 'public' ? 'groups.joined' : 'groups.pending'));
    } catch {
      toast.show({ variant: 'error', message: t('groups.failed') });
    }
  };

  return (
    <Screen testID="group-details.screen" scroll>
      <Pressable testID="group-details.back" accessibilityLabel="Back" onPress={navigation.goBack}><Icon name="back" color={colors.ink} /></Pressable>
      <View style={layout.hero}>
        <View style={[layout.avatar, { backgroundColor: data.color }]}><AppText variant="h1" tone="white">{data.name.slice(0, 1)}</AppText></View>
        <View style={layout.heroCopy}>
          <AppText variant="h1">{data.name}</AppText>
          <AppText tone="muted">{data.description}</AppText>
          <AppText variant="chip" tone="muted">{t('groups.members', { count: data.memberCount })} · {t(`groups.${data.visibility}`)}</AppText>
        </View>
      </View>

      {!active ? (
        membership?.status === 'pending' ? <AppText variant="chip">{t('groups.pending')}</AppText> : (
          <AppButton testID="group-details.join" label={data.visibility === 'public' ? t('groups.join') : t('groups.request')} onPress={() => void joinNow()} loading={join.isPending || session.loading} />
        )
      ) : null}
      {active ? (
        <AppButton testID="group-details.chat" label={t('groups.openChat')} onPress={() => navigation.navigate('GroupChat', { id: data.id })} />
      ) : null}

      {admin ? (
        <View style={[layout.panel, styles.panel]}>
          <View style={layout.rowBetween}>
            <AppText variant="h2">{t('groups.invite')}</AppText>
            <Pressable testID="group-details.edit" accessibilityLabel={t('groups.edit')} onPress={() => navigation.navigate('EditGroup', { id: data.id })}>
              <AppText variant="chip" tone="teal700">{t('groups.edit')}</AppText>
            </Pressable>
          </View>
          <TextField testID="group-details.invite-username" label={t('groups.inviteUsername')} value={username} onChangeText={setUsername} maxLength={20} />
          <AppButton
            testID="group-details.invite"
            label={t('groups.sendInvite')}
            disabled={username.trim().length < 3}
            loading={invite.isPending}
            onPress={() => void run(invite.mutateAsync({ id: data.id, data: { username: username.trim() } }), t('groups.inviteSent')).then(() => setUsername(''))}
          />
        </View>
      ) : null}

      {admin && data.pendingRequests.length ? (
        <View style={layout.section}>
          <AppText variant="h2">{t('groups.requests')}</AppText>
          {data.pendingRequests.map(member => (
            <MemberRow key={member.userId} member={member}>
              <Small label={t('groups.approve')} testID={`group-details.approve-${member.userId}`} onPress={() => void run(approve.mutateAsync({ id: data.id, userId: member.userId }))} />
              <Small label={t('groups.reject')} testID={`group-details.reject-${member.userId}`} onPress={() => void run(reject.mutateAsync({ id: data.id, userId: member.userId }))} />
            </MemberRow>
          ))}
        </View>
      ) : null}

      <View style={layout.section}>
        <AppText variant="h2">{t('groups.members', { count: data.memberCount })}</AppText>
        {data.members.map(member => (
          <MemberRow key={member.userId} member={member}>
            {owner && member.userId !== auth.user?.id ? (
              <>
                <Small
                  label={t(member.role === 'admin' ? 'groups.removeAdmin' : 'groups.makeAdmin')}
                  testID={`group-details.admin-${member.userId}`}
                  onPress={() => void run(setAdmin.mutateAsync({ id: data.id, userId: member.userId, data: { admin: member.role !== 'admin' } }))}
                />
                <Small label={t('groups.transfer')} testID={`group-details.transfer-${member.userId}`} onPress={() => void run(transfer.mutateAsync({ id: data.id, userId: member.userId }))} />
              </>
            ) : null}
            {admin && member.userId !== auth.user?.id && member.role !== 'owner' && (owner || member.role === 'member') ? (
              <Small label={t('groups.remove')} testID={`group-details.remove-${member.userId}`} danger onPress={() => void run(remove.mutateAsync({ id: data.id, userId: member.userId }))} />
            ) : null}
          </MemberRow>
        ))}
      </View>

      {active && !owner ? <AppButton testID="group-details.leave" label={t('groups.leave')} variant="white" onPress={() => void run(leave.mutateAsync({ id: data.id })).then(() => navigation.goBack())} /> : null}
      {owner ? (
        <AppButton
          testID="group-details.delete"
          label={t('groups.delete')}
          variant="danger"
          onPress={() => Alert.alert(t('groups.delete'), data.name, [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('groups.delete'), style: 'destructive', onPress: () => void run(removeGroup.mutateAsync({ id: data.id })).then(() => navigation.goBack()) },
          ])}
        />
      ) : null}
    </Screen>
  );
}

function MemberRow({ member, children }: { member: GroupMemberDto; children?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[layout.member, styles.panel]}>
      <View style={layout.memberCopy}>
        <AppText variant="h3">{member.displayName ?? member.username}</AppText>
        <AppText variant="caption" tone="muted">@{member.username} · L{member.level}{member.verifiedLeader ? ` · ${t('groups.leader')}` : ''}{member.role !== 'member' ? ` · ${t(`groups.${member.role}`)}` : ''}</AppText>
      </View>
      {children ? <View style={layout.memberActions}>{children}</View> : null}
    </View>
  );
}

function Small({ label, testID, onPress, danger = false }: { label: string; testID: string; onPress: () => void; danger?: boolean }) {
  const styles = useStyles();
  return <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} style={[layout.small, styles.small]}><AppText variant="caption" tone={danger ? 'red700' : 'teal700'}>{label}</AppText></Pressable>;
}

const layout = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  avatar: { width: 72, height: 72, borderRadius: radii.card, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: spacing[4] },
  panel: { gap: spacing[12], padding: spacing[14], borderRadius: radii.card, borderWidth: borders.card },
  section: { gap: spacing[10] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  member: { flexDirection: 'row', alignItems: 'center', gap: spacing[8], padding: spacing[12], borderRadius: radii.card },
  memberCopy: { flex: 1, gap: spacing[4] },
  memberActions: { alignItems: 'flex-end', gap: spacing[4] },
  small: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing[8] },
});
const useStyles = createThemedStyles(c => ({ panel: { backgroundColor: c.card, borderColor: c.line }, small: { backgroundColor: c.soft, borderRadius: radii.pill } }));

