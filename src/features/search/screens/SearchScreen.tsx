import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useSearchQuery } from '../../../shared/api/generated/search/search';
import { useGroupsJoin } from '../../../shared/api/generated/groups/groups';
import type { SearchScope } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { AppButton } from '../../../shared/components/AppButton';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { TextField } from '../../../shared/components/TextField';
import { radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { getLocale } from '../../../shared/i18n';
import { formatDistance, formatElevation } from '../../../shared/utils/units';
import { useGuestSession } from '../../../shared/auth/useGuestSession';
import { toast } from '../../../shared/components/toastBus';
import { t } from '../../../shared/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'all' | SearchScope;
const tabs: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'places', label: 'Places' },
  { key: 'people', label: 'People' },
  { key: 'groups', label: 'Groups' },
  { key: 'tours', label: 'Tours' },
];

export function SearchScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const guest = useGuestSession('group_join');
  const join = useGroupsJoin();
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  const scope = tab === 'all' ? 'all' : tab;
  const query = useSearchQuery(
    { q, scope },
    { query: { enabled: q.length >= 2 } },
  );
  const showPlaces = tab === 'all' || tab === 'places';
  const showPeople = tab === 'all' || tab === 'people';
  const showGroups = tab === 'all' || tab === 'groups';
  const comingSoon = tab === 'tours';
  return (
    <Screen testID="search.screen" scroll keyboardAware>
      <View style={layout.header}>
        <Pressable
          testID="search.back"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1">Search</AppText>
      </View>
      <TextField
        testID="search.input"
        label="Find places and people"
        value={input}
        autoFocus
        onChangeText={setInput}
        placeholder="Search Irbis"
      />
      <View style={layout.tabs}>
        {tabs.map(item => (
          <Pressable
            key={item.key}
            testID={`search.tab-${item.key}`}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item.key }}
            onPress={() => setTab(item.key)}
            style={[layout.tab, tab === item.key ? styles.active : styles.tab]}
          >
            <AppText variant="small">{item.label}</AppText>
          </Pressable>
        ))}
      </View>
      {comingSoon ? (
        <EmptyState
          testID={`search.${tab}-empty`}
          mascot="proud"
          mascotLabel="Irbis"
          title="Tours are coming soon"
          body="This search tab is ready for the next community release."
        />
      ) : q.length < 2 ? (
        <EmptyState
          testID="search.empty"
          mascot="default"
          mascotLabel="Irbis"
          title="Start exploring"
          body="Type at least two characters."
        />
      ) : query.isLoading ? (
        <>
          <Skeleton height={82} />
          <Skeleton height={82} />
        </>
      ) : query.error || !query.data ? (
        <ErrorState
          testID="search.error"
          retryTestID="search.retry"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          {showPlaces ? (
            <View testID="search.places" style={layout.section}>
              <AppText variant="h2">Places</AppText>
              {query.data.places.length ? (
                query.data.places.map(place => (
                  <Pressable
                    key={place.id}
                    testID={`search.place-${place.id}`}
                    accessibilityLabel={
                      place.name[getLocale()] ?? place.name.uz
                    }
                    onPress={() =>
                      navigation.navigate('Place', { id: place.id })
                    }
                    style={[layout.result, styles.result]}
                  >
                    <View style={layout.copy}>
                      <AppText variant="body">
                        {place.name[getLocale()] ?? place.name.uz}
                      </AppText>
                      <AppText variant="small" tone="muted">
                        {formatDistance(place.distanceM)} ·{' '}
                        {formatElevation(place.elevationM)}
                      </AppText>
                    </View>
                    <Icon name="chevron" color={colors.muted} />
                  </Pressable>
                ))
              ) : (
                <AppText variant="small" tone="muted">
                  No places found.
                </AppText>
              )}
            </View>
          ) : null}
          {showPeople ? (
            <View testID="search.people" style={layout.section}>
              <AppText variant="h2">People</AppText>
              {query.data.people.length ? (
                query.data.people.map(person => (
                  <Pressable
                    key={person.username}
                    testID={`search.person-${person.username}`}
                    accessibilityLabel={person.displayName ?? person.username}
                    onPress={() =>
                      navigation.navigate('PublicProfile', {
                        username: person.username,
                      })
                    }
                    style={[layout.result, styles.result]}
                  >
                    {person.avatarUrl ? (
                      <Image
                        source={{ uri: person.avatarUrl }}
                        style={layout.avatar}
                      />
                    ) : (
                      <View style={[layout.avatar, styles.initials]}>
                        <AppText variant="chip">
                          {(person.displayName ?? person.username)
                            .slice(0, 2)
                            .toUpperCase()}
                        </AppText>
                      </View>
                    )}
                    <View style={layout.copy}>
                      <AppText variant="body">
                        {person.displayName ?? `@${person.username}`}
                      </AppText>
                      <AppText variant="small" tone="muted">
                        @{person.username} · Level {person.level}
                      </AppText>
                    </View>
                    <Icon name="chevron" color={colors.muted} />
                  </Pressable>
                ))
              ) : (
                <AppText variant="small" tone="muted">
                  No public explorers found.
                </AppText>
              )}
            </View>
          ) : null}
          {showGroups ? (
            <View testID="search.groups" style={layout.section}>
              <AppText variant="h2">Groups</AppText>
              {query.data.groups.length ? query.data.groups.map(group => (
                <View key={group.id} style={[layout.result, styles.result]}>
                  <Pressable
                    testID={`search.group-${group.id}`}
                    accessibilityLabel={group.name}
                    onPress={() => navigation.navigate('GroupDetails', { id: group.id })}
                    style={layout.copy}
                  >
                    <AppText variant="body">{group.name}</AppText>
                    <AppText variant="small" tone="muted">{group.memberCount} members · {group.description}</AppText>
                  </Pressable>
                  <View style={layout.join}>
                    <AppButton
                      testID={`search.group-join-${group.id}`}
                      label={t('groups.join')}
                      loading={join.isPending || guest.loading}
                      onPress={() => void guest.ensure()
                        .then(() => join.mutateAsync({ id: group.id }))
                        .then(() => { toast.show({ variant: 'success', message: t('groups.joined') }); navigation.navigate('GroupDetails', { id: group.id }); })
                        .catch(() => toast.show({ variant: 'error', message: t('groups.failed') }))}
                    />
                  </View>
                </View>
              )) : <AppText variant="small" tone="muted">No public groups found.</AppText>}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[6] },
  tab: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  section: { gap: spacing[8] },
  result: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    padding: spacing[10],
    borderRadius: radii.tile,
  },
  copy: { flex: 1, gap: spacing[4] },
  join: { width: 96 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  initials: { alignItems: 'center', justifyContent: 'center' },
});
const useStyles = createThemedStyles(c => ({
  tab: { backgroundColor: c.card },
  active: {
    backgroundColor: c.navActiveBg,
    borderColor: c.teal,
    borderWidth: 1,
  },
  result: { backgroundColor: c.card },
  initials: { backgroundColor: c.navActiveBg },
}));
