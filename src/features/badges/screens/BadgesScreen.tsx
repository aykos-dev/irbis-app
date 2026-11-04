import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import {
  useBadgesList,
  useMeSetBadgesShowcase,
} from '../../../shared/api/generated/badges/badges';
import type { BadgeGroup } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { toast } from '../../../shared/components/toastBus';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { getLocale, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { BadgeTile } from '../components/BadgeTile';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | BadgeGroup;

export function BadgesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useStyles();
  const { status } = useAuth();
  const locale = getLocale() as Locale;
  const query = useBadgesList();
  const save = useMeSetBadgesShowcase();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (query.data) setSelected(query.data.showcase);
  }, [query.data]);

  const items = useMemo(
    () =>
      query.data?.items.filter(
        item => filter === 'all' || item.group === filter,
      ) ?? [],
    [filter, query.data?.items],
  );

  const toggle = (key: string) => {
    setSelected(current => {
      if (current.includes(key)) return current.filter(item => item !== key);
      if (current.length >= 4) {
        toast.show({ variant: 'info', message: 'Choose up to four badges.' });
        return current;
      }
      haptics.tap();
      return [...current, key];
    });
  };

  const saveShowcase = async () => {
    try {
      const next = await save.mutateAsync({ data: { keys: selected } });
      setSelected(next.showcase);
      await query.refetch();
      haptics.success();
      toast.show({ variant: 'success', message: 'Badge showcase saved.' });
    } catch {
      toast.show({
        variant: 'error',
        message: 'Could not save your showcase. Try again.',
      });
    }
  };

  return (
    <Screen testID="badges.screen" scroll>
      <View style={layout.header}>
        <Pressable
          testID="badges.back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <View style={layout.heading}>
          <AppText variant="h1" accessibilityRole="header">
            Badges
          </AppText>
          <AppText variant="small" tone="muted">
            {query.data
              ? `${query.data.collected} of ${query.data.total} collected`
              : '64 adventures to unlock'}
          </AppText>
        </View>
      </View>

      {query.isLoading ? (
        <View style={layout.grid}>
          <Skeleton height={250} />
          <Skeleton height={250} />
        </View>
      ) : query.error || !query.data ? (
        <ErrorState
          testID="badges.error"
          retryTestID="badges.retry"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <>
          <View style={layout.filters}>
            <FilterChip
              label="All"
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {query.data.groups.map(group => (
              <FilterChip
                key={group.key}
                label={`${group.title[locale]} ${group.earned}/${group.total}`}
                active={filter === group.key}
                onPress={() => setFilter(group.key)}
              />
            ))}
          </View>
          {status === 'signedIn' ? (
            <View style={[layout.showcase, styles.showcase]}>
              <AppText variant="h3">Profile showcase</AppText>
              <AppText variant="small" tone="muted">
                Pick up to four earned badges · {selected.length}/4
              </AppText>
              <AppButton
                testID="badges.showcase-save"
                label="Save showcase"
                loading={save.isPending}
                onPress={() => void saveShowcase()}
              />
            </View>
          ) : null}
          <View style={layout.grid}>
            {items.map(item => (
              <BadgeTile
                key={item.key}
                badge={item}
                locale={locale}
                selected={selected.includes(item.key)}
                selectable={status === 'signedIn' && item.earnedAt !== null}
                onPress={() => toggle(item.key)}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={`badges.filter-${label.toLowerCase().replace(/\s+/g, '-')}`}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[layout.chip, active ? styles.chipActive : styles.chip]}
    >
      <AppText
        variant="small"
        style={active ? styles.chipTextActive : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  heading: { flex: 1, gap: spacing[4] },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing[12],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  showcase: { gap: spacing[8], padding: spacing[14], borderRadius: radii.tile },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[12],
  },
});

const useStyles = createThemedStyles(c => ({
  chip: { backgroundColor: c.card, borderColor: c.line, borderWidth: 1 },
  chipActive: {
    backgroundColor: c.navActiveBg,
    borderColor: c.navActiveBorder,
    borderWidth: 1,
  },
  chipTextActive: { color: c.navActiveFg },
  showcase: { backgroundColor: c.card },
}));
