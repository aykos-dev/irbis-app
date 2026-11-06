import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import {
  getGroupsListQueryKey,
  useGroupsAcceptInvitation,
  useGroupsDeclineInvitation,
  useGroupsJoin,
  useGroupsList,
} from '../../../shared/api/generated/groups/groups';
import type { GroupSummaryDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Pressable } from '../../../shared/components/Pressable';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { toast } from '../../../shared/components/toastBus';
import { useGuestSession } from '../../../shared/auth/useGuestSession';
import { UpcomingTrips } from '../components/UpcomingTrips';

export function GroupsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const session = useGuestSession('group_join');
  const query = useGroupsList();
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGroupsListQueryKey() });
  const join = useGroupsJoin({ mutation: { onSuccess: refresh } });
  const accept = useGroupsAcceptInvitation({ mutation: { onSuccess: refresh } });
  const decline = useGroupsDeclineInvitation({ mutation: { onSuccess: refresh } });

  const joinGroup = async (group: GroupSummaryDto) => {
    try {
      await session.ensure();
      const result = await join.mutateAsync({ id: group.id });
      toast.show({ variant: 'success', message: result.status === 'pending' ? t('groups.pending') : t('groups.joined') });
    } catch {
      toast.show({ variant: 'error', message: t('groups.failed') });
    }
  };

  if (query.isError) {
    return <ErrorState testID="groups.error" retryTestID="groups.retry" error={query.error} onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  return (
    <View testID="groups.screen" style={layout.root}>
      <View style={layout.heading}>
        <AppText variant="h1">{t('groups.title')}</AppText>
        <View style={layout.createButton}>
          <AppButton testID="groups.create" label={t('groups.create')} onPress={() => navigation.navigate('CreateGroup')} />
        </View>
      </View>

      <FindBuddiesCard onPress={() => navigation.navigate('Buddies')} />

      {data?.invitations.length ? (
        <Section title={t('groups.invitations')}>
          {data.invitations.map(group => (
            <GroupCard key={group.id} group={group} onOpen={() => navigation.navigate('GroupDetails', { id: group.id })}>
              <View style={layout.actions}>
                <SmallAction label={t('groups.accept')} testID={`groups.accept-${group.id}`} onPress={() => void accept.mutateAsync({ id: group.id })} />
                <SmallAction label={t('groups.decline')} testID={`groups.decline-${group.id}`} onPress={() => void decline.mutateAsync({ id: group.id })} />
              </View>
            </GroupCard>
          ))}
        </Section>
      ) : null}

      <Section title={t('groups.yourGroups')}>
        {data?.yours.length ? data.yours.map(group => (
          <GroupCard key={group.id} group={group} onOpen={() => navigation.navigate('GroupDetails', { id: group.id })} />
        )) : <AppText tone="muted">{t('groups.emptyYours')}</AppText>}
      </Section>

      <UpcomingTrips />

      <Section title={t('groups.discover')}>
        {data?.discover.length ? data.discover.map(group => (
          <GroupCard key={group.id} group={group} onOpen={() => navigation.navigate('GroupDetails', { id: group.id })}>
            {group.viewerMembership?.status === 'pending' ? (
              <AppText variant="chip" tone="muted">{t('groups.pending')}</AppText>
            ) : (
              <SmallAction
                label={group.visibility === 'public' ? t('groups.join') : t('groups.request')}
                testID={`groups.join-${group.id}`}
                loading={join.isPending || session.loading}
                onPress={() => void joinGroup(group)}
              />
            )}
          </GroupCard>
        )) : <AppText tone="muted">{t('groups.emptyDiscover')}</AppText>}
      </Section>
    </View>
  );
}

/** "Find buddies" entry (buddies AC1, canvas Groups → Buddies). */
function FindBuddiesCard({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const title = t('buddies.groupsCard.title');
  return (
    <Pressable testID="groups.find-buddies" accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={[layout.buddies, styles.buddies]}>
      <View style={layout.copy}>
        <AppText variant="h2" tone="onOrange">{title}</AppText>
        <AppText variant="small" tone="onOrange">{t('buddies.groupsCard.body')}</AppText>
      </View>
      <View style={layout.companions}>
        {BUDDY_LEVELS.map(level => (
          <View key={level} style={[layout.companion, { backgroundColor: levelMeta(level).tint }]}>
            <CompanionArt level={level} size={COMPANION} />
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={layout.section}><AppText variant="chip" tone="muted">{title.toUpperCase()}</AppText>{children}</View>;
}

function GroupCard({ group, onOpen, children }: { group: GroupSummaryDto; onOpen: () => void; children?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable testID={`groups.group-${group.id}`} accessibilityLabel={group.name} onPress={onOpen} style={[layout.card, styles.card]}>
      <View style={[layout.avatar, { backgroundColor: group.color }]}><AppText variant="h3" tone="white">{group.name.slice(0, 1).toUpperCase()}</AppText></View>
      <View style={layout.copy}>
        <AppText variant="h3">{group.name}</AppText>
        <AppText variant="small" tone="muted" numberOfLines={2}>{group.description}</AppText>
        <AppText variant="caption" tone="muted">{t('groups.members', { count: group.memberCount })}</AppText>
      </View>
      {group.unreadCount > 0 ? (
        <View testID={`groups.unread-${group.id}`} style={[layout.unread, styles.unread]}>
          <AppText variant="chip" tone="white">{group.unreadCount > 99 ? '99+' : group.unreadCount}</AppText>
        </View>
      ) : null}
      {children}
    </Pressable>
  );
}

function SmallAction({ label, testID, onPress, loading = false }: { label: string; testID: string; onPress: () => void; loading?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable testID={testID} accessibilityLabel={label} onPress={onPress} disabled={loading} style={[layout.smallAction, styles.action]}>
      <AppText variant="chip" tone="teal700">{label}</AppText>
    </Pressable>
  );
}

const BUDDY_LEVELS = [4, 1, 5] as const;
const COMPANION = 46;

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  createButton: { width: 150 },
  section: { gap: spacing[10] },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[12], padding: spacing[12], borderRadius: radii.card, borderWidth: borders.card },
  avatar: { width: 52, height: 52, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: spacing[4] },
  actions: { gap: spacing[6] },
  smallAction: { minHeight: 40, paddingHorizontal: spacing[10], borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  buddies: { flexDirection: 'row', alignItems: 'center', gap: spacing[12], padding: spacing[16], borderRadius: radii.card, borderWidth: borders.card, borderBottomWidth: borders.edge },
  companions: { flexDirection: 'row' },
  companion: { width: COMPANION, height: COMPANION, borderRadius: radii.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', marginStart: -spacing[10] },
  unread: { minWidth: 26, height: 26, paddingHorizontal: spacing[6], borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
  action: { backgroundColor: c.soft },
  unread: { backgroundColor: c.red700 },
  buddies: { backgroundColor: c.orange, borderColor: c.orangeEdge },
}));

