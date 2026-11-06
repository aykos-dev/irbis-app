import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import {
  getGroupChatListQueryKey,
  useGroupChatAddReaction,
  useGroupChatDelete,
  useGroupChatEdit,
  useGroupChatList,
  useGroupChatMarkRead,
  useGroupChatMute,
  useGroupChatRemoveReaction,
  useGroupChatSend,
  useGroupChatUploadPhoto,
} from '../../../shared/api/generated/group-chat/group-chat';
import { useGroupsGet } from '../../../shared/api/generated/groups/groups';
import type { ConditionStatus, GroupMessageAttachmentDto, GroupMessageDto } from '../../../shared/api/generated/model';
import { useSearchQuery } from '../../../shared/api/generated/search/search';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { StatusChip } from '../../../shared/components/StatusChip';
import { statusVariant } from '../../../shared/components/conditions/reasonText';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { getLocale, t } from '../../../shared/i18n';
import { formatTripStart } from '../../../shared/utils/format';
import { useGroupChatSocket } from '../hooks/useGroupChatSocket';

const reactions = ['👍', '❤️', '🔥', '👏'] as const;

export function GroupChatScreen({ navigation, route }: RootStackScreenProps<'GroupChat'>) {
  const groupId = route.params.id;
  const { colors } = useTheme();
  const styles = useStyles();
  const auth = useAuth();
  const client = useQueryClient();
  const group = useGroupsGet(groupId);
  const messages = useGroupChatList(groupId, { limit: 50 });
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [olderItems, setOlderItems] = useState<GroupMessageDto[]>([]);
  const older = useGroupChatList(
    groupId,
    { limit: 50, ...(olderCursor ? { cursor: olderCursor } : {}) },
    { query: { enabled: olderCursor !== null } },
  );
  const socket = useGroupChatSocket(groupId);
  const send = useGroupChatSend();
  const edit = useGroupChatEdit();
  const remove = useGroupChatDelete();
  const addReaction = useGroupChatAddReaction();
  const removeReaction = useGroupChatRemoveReaction();
  const { mutate: markRead } = useGroupChatMarkRead();
  const mute = useGroupChatMute();
  const upload = useGroupChatUploadPhoto();
  const [body, setBody] = useState('');
  const list = useRef<ScrollViewInstance>(null);
  const [replyTo, setReplyTo] = useState<GroupMessageDto | null>(null);
  const [editing, setEditing] = useState<GroupMessageDto | null>(null);
  const [attachments, setAttachments] = useState<GroupMessageAttachmentDto[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [placeInput, setPlaceInput] = useState('');
  const placeSearch = useSearchQuery(
    { q: placeInput.trim(), scope: 'places' },
    { query: { enabled: placeInput.trim().length >= 2 } },
  );
  const key = getGroupChatListQueryKey(groupId, { limit: 50 });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  useEffect(() => {
    if (messages.data && olderItems.length === 0) setNextCursor(messages.data.nextCursor);
  }, [messages.data, olderItems.length]);
  useEffect(() => {
    if (!older.data || !olderCursor) return;
    setOlderItems(current => {
      const known = new Set(current.map(item => item.id));
      return [...older.data.items.filter(item => !known.has(item.id)), ...current];
    });
    setNextCursor(older.data.nextCursor);
    setOlderCursor(null);
  }, [older.data, olderCursor]);
  const items = useMemo(() => [...olderItems, ...(messages.data?.items ?? [])], [messages.data?.items, olderItems]);
  const lastId = items.at(-1)?.id;

  useEffect(() => {
    if (lastId) markRead({ groupId, data: { messageId: lastId } });
  }, [groupId, lastId, markRead]);

  const busy = send.isPending || edit.isPending;
  const muted = group.data?.viewerMembership?.notificationsMuted ?? false;
  const canModerate = ['owner', 'admin'].includes(group.data?.viewerMembership?.role ?? '');
  const typing = socket.typingUserIds.filter(id => id !== auth.user?.id).length > 0;

  const submit = async () => {
    const text = body.trim();
    if (!text && !attachments.length) return;
    try {
      if (editing) {
        await edit.mutateAsync({ groupId, messageId: editing.id, data: { body: text } });
      } else {
        await send.mutateAsync({
          groupId,
          data: {
            ...(text ? { body: text } : {}),
            ...(replyTo ? { replyToId: replyTo.id } : {}),
            ...(attachments.length ? { attachments } : {}),
          },
        });
      }
      setBody('');
      setReplyTo(null);
      setEditing(null);
      setAttachments([]);
      setAttachOpen(false);
      socket.setTyping(false);
      await refresh();
    } catch {
      toast.show({ variant: 'error', message: t('groups.failed') });
    }
  };

  const attachPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeExtra: false });
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    try {
      const image = { uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.fileName ?? 'group-photo.jpg' } as unknown as Blob;
      const uploaded = await upload.mutateAsync({ groupId, data: { image } });
      setAttachments(current => [...current.filter(item => item.type !== 'photo'), { type: 'photo', imageKey: uploaded.imageKey }]);
    } catch {
      toast.show({ variant: 'error', message: t('groupChat.photoFailed') });
    }
  };

  const react = async (message: GroupMessageDto, emoji: string) => {
    const mine = message.reactions.some(item => item.emoji === emoji && item.mine);
    const action = mine ? removeReaction.mutateAsync({ groupId, messageId: message.id, data: { emoji } }) : addReaction.mutateAsync({ groupId, messageId: message.id, data: { emoji } });
    try { await action; await refresh(); } catch { toast.show({ variant: 'error', message: t('groups.failed') }); }
  };

  if (messages.error) {
    return <Screen testID="group-chat.screen"><ErrorState testID="group-chat.error" retryTestID="group-chat.retry" error={messages.error} onRetry={() => void messages.refetch()} /></Screen>;
  }

  return (
    <Screen testID="group-chat.screen">
      <KeyboardAvoidingView behavior="padding" style={layout.fill}>
      <View style={layout.header}>
        <Pressable testID="group-chat.back" accessibilityLabel="Back" onPress={navigation.goBack}><Icon name="back" color={colors.ink} /></Pressable>
        <View style={[layout.groupAvatar, { backgroundColor: group.data?.color ?? colors.teal }]}><AppText variant="h3" tone="white">{group.data?.name.slice(0, 1) ?? 'G'}</AppText></View>
        <View style={layout.headerCopy}>
          <AppText variant="h3">{group.data?.name ?? t('groups.title')}</AppText>
          <AppText variant="caption" tone="muted">{t('groups.members', { count: group.data?.memberCount ?? 0 })} · {t('groupChat.online', { count: socket.onlineCount })}</AppText>
        </View>
        <Pressable
          testID="group-chat.mute"
          accessibilityLabel={t(muted ? 'groupChat.unmute' : 'groupChat.mute')}
          onPress={() => void mute.mutateAsync({ groupId, data: { muted: !muted } }).then(() => void group.refetch())}
        ><Icon name="bell" color={muted ? colors.muted : colors.teal} /></Pressable>
      </View>

      {/* Only the messages scroll; the header stays on top and the composer stays pinned to the bottom. */}
      <ScrollView
        ref={list}
        testID="group-chat.messages"
        style={layout.fill}
        contentContainerStyle={layout.messages}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
      >
        {nextCursor ? <AppButton testID="group-chat.older" label={t('groupChat.loadOlder')} variant="white" loading={older.isLoading} onPress={() => setOlderCursor(nextCursor)} /> : null}
        {!items.length && !messages.isLoading ? <AppText tone="muted">{t('groupChat.empty')}</AppText> : null}
        {items.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            mine={message.author?.id === auth.user?.id}
            canDelete={canModerate || message.author?.id === auth.user?.id}
            onReply={() => { setReplyTo(message); setEditing(null); }}
            onEdit={() => { setEditing(message); setReplyTo(null); setBody(message.body ?? ''); }}
            onDelete={() => void remove.mutateAsync({ groupId, messageId: message.id }).then(() => refresh())}
            onReact={emoji => void react(message, emoji)}
          />
        ))}
      </ScrollView>
      {typing ? <AppText testID="group-chat.typing" variant="caption" tone="muted">{t('groupChat.typing')}</AppText> : null}

      {replyTo || editing ? (
        <View style={[layout.context, styles.context]}>
          <AppText variant="small" numberOfLines={1}>{editing ? t('groupChat.editing') : t('groupChat.replying', { username: replyTo?.author?.username ?? '' })}</AppText>
          <Pressable testID="group-chat.context-cancel" accessibilityLabel={t('groupChat.cancel')} onPress={() => { setReplyTo(null); setEditing(null); setBody(''); }}><Icon name="close" color={colors.muted} /></Pressable>
        </View>
      ) : null}

      {attachments.length ? <AppText variant="caption" tone="teal700">{attachments.map(item => item.type === 'photo' ? t('groupChat.photo') : t('groupChat.place')).join(' · ')}</AppText> : null}
      {attachOpen ? (
        <View testID="group-chat.attachments" style={[layout.attachPanel, styles.context]}>
          <AppButton testID="group-chat.attach-photo" label={t('groupChat.photo')} variant="white" loading={upload.isPending} onPress={() => void attachPhoto()} />
          <TextField testID="group-chat.place-search" label={t('groupChat.place')} value={placeInput} onChangeText={setPlaceInput} />
          {placeSearch.data?.places.slice(0, 3).map(place => (
            <Pressable
              key={place.id}
              testID={`group-chat.place-${place.id}`}
              accessibilityLabel={place.name.en ?? place.name.uz}
              onPress={() => { setAttachments(current => [...current.filter(item => item.type !== 'place'), { type: 'place', placeId: place.id }]); setPlaceInput(''); }}
              style={layout.placeResult}
            ><AppText>{place.name.en ?? place.name.uz}</AppText></Pressable>
          ))}
        </View>
      ) : null}

      <View style={layout.composer}>
        <Pressable testID="group-chat.attach" accessibilityLabel={t('groupChat.attach')} onPress={() => setAttachOpen(value => !value)} style={[layout.iconButton, styles.context]}><Icon name="plus" color={colors.teal} /></Pressable>
        <TextInput
          testID="group-chat.input"
          accessibilityLabel={t('groupChat.message')}
          placeholder={t('groupChat.message')}
          placeholderTextColor={colors.muted}
          value={body}
          onChangeText={text => { setBody(text); socket.setTyping(text.length > 0); }}
          maxLength={2000}
          multiline
          style={[layout.input, styles.input]}
        />
        <Pressable testID="group-chat.send" accessibilityLabel={t('groupChat.send')} disabled={busy || (!body.trim() && !attachments.length)} onPress={() => void submit()} style={[layout.iconButton, styles.send]}><Icon name="arrowUp" color={colors.white} /></Pressable>
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function MessageBubble({ message, mine, canDelete, onReply, onEdit, onDelete, onReact }: {
  message: GroupMessageDto; mine: boolean; canDelete: boolean; onReply: () => void; onEdit: () => void; onDelete: () => void; onReact: (emoji: string) => void;
}) {
  const styles = useStyles();
  const trip = message.trip;
  if (trip) return <TripCard message={message} />;
  return (
    <View testID={`group-chat.message-${message.id}`} style={[layout.message, mine ? layout.mineRow : null]}>
      <View style={[layout.bubble, mine ? styles.mine : styles.theirs]}>
        {!mine && message.author ? <AppText variant="caption" tone="teal700">{message.author.displayName ?? message.author.username}{message.author.verifiedLeader ? ' · 🛡' : ''}</AppText> : null}
        {message.replyTo ? <AppText variant="caption" tone="muted">↩ @{message.replyTo.username ?? ''}: {message.replyTo.body ?? t('groupChat.deleted')}</AppText> : null}
        {message.deletedAt ? <AppText tone="muted">{t('groupChat.deleted')}</AppText> : <AppText tone={mine ? 'white' : 'ink'}>{message.body}</AppText>}
        {message.attachments.map((attachment, index) => attachment.type === 'photo' && attachment.imageUrl ? (
          <Image key={`${message.id}-${index}`} source={{ uri: attachment.imageUrl }} style={layout.photo} />
        ) : attachment.placeId ? (
          <View key={`${message.id}-${index}`} style={layout.place}><AppText variant="chip">📍 {attachment.placeName}</AppText></View>
        ) : null)}
        <View style={layout.meta}>
          {message.editedAt ? <AppText variant="caption" tone={mine ? 'white' : 'muted'}>{t('groupChat.edited')}</AppText> : null}
          {mine && message.readByCount ? <AppText variant="caption" tone="white">{t('groupChat.readBy', { count: message.readByCount })}</AppText> : null}
        </View>
      </View>
      {!message.deletedAt ? (
        <View style={layout.messageActions}>
          <Pressable testID={`group-chat.reply-${message.id}`} accessibilityLabel={t('groupChat.reply')} onPress={onReply}><AppText variant="caption" tone="teal700">{t('groupChat.reply')}</AppText></Pressable>
          {mine ? <Pressable testID={`group-chat.edit-${message.id}`} accessibilityLabel={t('groupChat.edit')} onPress={onEdit}><AppText variant="caption" tone="teal700">{t('groupChat.edit')}</AppText></Pressable> : null}
          {canDelete ? <Pressable testID={`group-chat.delete-${message.id}`} accessibilityLabel={t('groupChat.delete')} onPress={onDelete}><AppText variant="caption" tone="red700">{t('groupChat.delete')}</AppText></Pressable> : null}
        </View>
      ) : null}
      <View style={layout.reactions}>
        {reactions.map(emoji => {
          const value = message.reactions.find(item => item.emoji === emoji);
          return <Pressable key={emoji} testID={`group-chat.react-${message.id}-${emoji}`} accessibilityLabel={emoji} onPress={() => onReact(emoji)} style={[layout.reaction, value?.mine ? styles.reactionMine : styles.context]}><AppText variant="caption">{emoji}{value ? ` ${value.count}` : ''}</AppText></Pressable>;
        })}
      </View>
    </View>
  );
}

function isConditionStatus(value: string): value is ConditionStatus {
  return Object.keys(statusVariant).includes(value);
}

/** A live trip card (trip-events AC8) opens the trip page; seeded cards stay read-only. */
function TripCard({ message }: { message: GroupMessageDto }) {
  const styles = useStyles();
  const navigation = useNavigation();
  const trip = message.trip;
  if (!trip) return null;
  const { groupTripId } = trip;
  if (groupTripId) {
    const spots = trip.capacity > 0
      ? t('tripEvents.discover.cardSpots', { joined: trip.joined, capacity: trip.capacity, count: Math.max(trip.capacity - trip.joined, 0) })
      : t('tripEvents.discover.going', { count: trip.joined });
    const status = isConditionStatus(trip.condition) ? trip.condition : null;
    return (
      <Pressable
        testID={`group-chat.trip-${message.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${trip.title} · ${spots}`}
        onPress={() => navigation.navigate('GroupTrip', { id: groupTripId })}
        style={[layout.trip, styles.theirs]}
      >
        <AppText variant="h3">{trip.title}</AppText>
        <AppText variant="small" tone="muted">{formatTripStart(new Date(trip.startsAt), getLocale())}</AppText>
        <AppText testID={`group-chat.trip-${message.id}-spots`} variant="chip" tone="teal700">{spots}</AppText>
        <View style={layout.tripFoot}>
          {status ? <StatusChip testID={`group-chat.trip-${message.id}-condition`} variant={statusVariant[status]} label={t(`conditions.status.${status}`)} /> : <View />}
          <AppText variant="chip" tone="teal700">{t('tripEvents.discover.open')}</AppText>
        </View>
      </Pressable>
    );
  }
  return (
    <View testID={`group-chat.trip-${message.id}`} style={[layout.trip, styles.theirs]}>
      <AppText variant="h3">{trip.title}</AppText>
      <AppText variant="small" tone="muted">{new Date(trip.startsAt).toLocaleDateString()} · {trip.meetingTime}</AppText>
      <AppText variant="small">Difficulty {trip.difficulty} · Level {trip.requiredLevel}+</AppText>
      <AppText variant="chip" tone="teal700">{t('groupChat.spots', { joined: trip.joined, capacity: trip.capacity })}</AppText>
      <AppText variant="caption" tone="muted">{t('groupChat.tripReadOnly')}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[10] },
  groupAvatar: { width: 44, height: 44, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  fill: { flex: 1, gap: spacing[12] },
  messages: { flexGrow: 1, justifyContent: 'flex-end', gap: spacing[12], paddingVertical: spacing[8] },
  message: { alignItems: 'flex-start', gap: spacing[6] },
  mineRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '86%', gap: spacing[6], padding: spacing[10], borderRadius: radii.card },
  messageActions: { flexDirection: 'row', gap: spacing[12] },
  reactions: { flexDirection: 'row', gap: spacing[4], flexWrap: 'wrap' },
  reaction: { minWidth: 34, minHeight: 30, paddingHorizontal: spacing[6], borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 220, height: 160, borderRadius: radii.input },
  place: { padding: spacing[8] },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[8] },
  trip: { gap: spacing[8], padding: spacing[14], borderWidth: borders.card, borderRadius: radii.card },
  tripFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8], padding: spacing[8], borderRadius: radii.input },
  attachPanel: { gap: spacing[8], padding: spacing[10] },
  placeResult: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[8] },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[8] },
  iconButton: { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.input, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: sizes.touchTarget, maxHeight: 120, borderRadius: radii.input, paddingHorizontal: spacing[12], paddingVertical: spacing[10], fontSize: 15 },
});
const useStyles = createThemedStyles(c => ({
  theirs: { backgroundColor: c.card, borderColor: c.line },
  mine: { backgroundColor: c.teal700 },
  context: { backgroundColor: c.soft },
  reactionMine: { backgroundColor: c.navActiveBg },
  input: { backgroundColor: c.card, color: c.ink, borderColor: c.line, borderWidth: borders.card },
  send: { backgroundColor: c.teal700 },
}));
