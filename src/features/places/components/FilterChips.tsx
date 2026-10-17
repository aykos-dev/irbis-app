import { ScrollView, StyleSheet } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import type { ExploreFilters } from '../exploreFilters';

export type FilterKind = 'type' | 'difficulty' | 'distance';

const KINDS: FilterKind[] = ['type', 'difficulty', 'distance'];
/** More types than this collapse into "+N" (AC5). */
const TYPES_SHOWN = 2;

/** Chip text: the filter name, or its value once set (AC5). */
export function chipLabel(kind: FilterKind, filters: ExploreFilters): string {
  if (kind === 'type' && filters.types.length > 0) {
    const names = filters.types.slice(0, TYPES_SHOWN).map(type => t(`places.typePlural.${type}`));
    const rest = filters.types.length - TYPES_SHOWN;
    return rest > 0 ? `${names.join(' · ')} +${rest}` : names.join(' · ');
  }
  if (kind === 'difficulty' && filters.difficulty) {
    return t('places.filter.difficultyRange', filters.difficulty);
  }
  if (kind === 'distance' && filters.maxKm !== null) {
    return t('places.filter.maxKm', { km: filters.maxKm });
  }
  return t(`places.filter.${kind}`);
}

function isActive(kind: FilterKind, filters: ExploreFilters): boolean {
  if (kind === 'type') {
    return filters.types.length > 0;
  }
  return kind === 'difficulty' ? filters.difficulty !== null : filters.maxKm !== null;
}

type Props = { filters: ExploreFilters; onOpen: (kind: FilterKind) => void };

/** Type · Difficulty · Distance chips over the map (AC5); each opens its FilterSheet. */
export function FilterChips({ filters, onOpen }: Props) {
  const styles = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={layout.row}
      keyboardShouldPersistTaps="handled"
    >
      {KINDS.map(kind => {
        const active = isActive(kind, filters);
        const label = chipLabel(kind, filters);
        return (
          <Pressable
            key={kind}
            testID={`explore.filter.${kind}`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={() => onOpen(kind)}
            style={[styles.chip, active && styles.active]}
          >
            <AppText variant="chip" tone={active ? 'white' : 'ink'}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const layout = StyleSheet.create({
  row: { gap: spacing[8], paddingVertical: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  chip: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  active: { backgroundColor: c.teal700, borderColor: c.teal700 },
}));
