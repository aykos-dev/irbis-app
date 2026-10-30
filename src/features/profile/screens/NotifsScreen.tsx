import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import {
  useNotificationsList,
  useNotificationsReadAll,
} from '../../../shared/api/generated/notifications/notifications';
import type { NotificationCategory } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'all' | NotificationCategory;

export function NotifsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const [tab, setTab] = useState<Tab>('all');
  const query = useNotificationsList({
    ...(tab === 'all' ? {} : { category: tab }),
    limit: 50,
  });
  const markAll = useNotificationsReadAll();
  return (
    <Screen testID="notifs.screen" scroll>
      <View style={layout.header}>
        <Pressable
          testID="notifs.back"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <View style={layout.title}>
          <AppText variant="h1">Notifications</AppText>
          <AppText variant="small" tone="muted">
            {query.data?.unreadCount ?? 0} unread
          </AppText>
        </View>
      </View>
      <View style={layout.tabs}>
        {(['all', 'trips', 'social', 'rewards'] as Tab[]).map(item => (
          <Pressable
            key={item}
            testID={`notifs.tab-${item}`}
            accessibilityLabel={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => setTab(item)}
            style={[layout.tab, tab === item ? styles.active : styles.tab]}
          >
            <AppText variant="small">
              {item[0]?.toUpperCase()}
              {item.slice(1)}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppButton
        testID="notifs.mark-all-read"
        label="Mark all as read"
        variant="white"
        disabled={!query.data?.unreadCount}
        loading={markAll.isPending}
        onPress={async () => {
          await markAll.mutateAsync();
          await query.refetch();
        }}
      />
      {query.isLoading ? (
        <>
          <Skeleton height={88} />
          <Skeleton height={88} />
        </>
      ) : query.error ? (
        <ErrorState
          testID="notifs.error"
          retryTestID="notifs.retry"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : query.data?.items.length ? (
        <View testID="notifs.list" style={layout.list}>
          {query.data.items.map(item => (
            <View
              key={item.id}
              testID={`notifs.item-${item.id}`}
              style={[layout.item, styles.item]}
            >
              {item.readAt ? null : (
                <View style={[layout.dot, { backgroundColor: colors.teal }]} />
              )}
              <View style={layout.copy}>
                <AppText variant="body">{item.title}</AppText>
                {item.body ? (
                  <AppText variant="small" tone="muted">
                    {item.body}
                  </AppText>
                ) : null}
                <AppText variant="caption" tone="muted">
                  {new Date(item.createdAt).toLocaleString()}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          testID="notifs.empty"
          mascot="sleepy"
          mascotLabel="Sleeping Irbis"
          title="Nothing here yet"
          body="Trip, social and reward updates will appear here."
        />
      )}
    </Screen>
  );
}
const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  title: { flex: 1 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[6] },
  tab: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  list: { gap: spacing[10] },
  item: {
    minHeight: 80,
    flexDirection: 'row',
    gap: spacing[10],
    padding: spacing[12],
    borderRadius: radii.tile,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: spacing[6] },
  copy: { flex: 1, gap: spacing[4] },
});
const useStyles = createThemedStyles(c => ({
  tab: { backgroundColor: c.card },
  active: {
    backgroundColor: c.navActiveBg,
    borderColor: c.teal,
    borderWidth: 1,
  },
  item: { backgroundColor: c.card },
}));
