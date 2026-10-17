import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlaceType } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { Sheet } from '../../../shared/components/Sheet';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import {
  DIFFICULTY_LEVELS,
  DISTANCE_OPTIONS,
  type DifficultyRange,
  type ExploreFilters,
} from '../exploreFilters';
import type { FilterKind } from './FilterChips';

const TYPES = Object.values(PlaceType);
const FULL_RANGE: DifficultyRange = { min: 1, max: 5 };

type Props = {
  kind: FilterKind;
  filters: ExploreFilters;
  closing: boolean;
  onApply: (next: ExploreFilters) => void;
  onDismiss: () => void;
};

/**
 * One filter's options in a sheet (AC5). Edits a draft; "Show places" applies it, so map and list
 * refetch once. Selection haptic on every toggle.
 */
export function FilterSheet({ kind, filters, closing, onApply, onDismiss }: Props) {
  const [draft, setDraft] = useState(filters);
  const title = t(`places.filter.${kind}`);

  const update = (next: ExploreFilters) => {
    haptics.selection();
    setDraft(next);
  };

  return (
    <Sheet
      testID={`explore.filter-sheet.${kind}`}
      accessibilityLabel={title}
      closing={closing}
      onDismiss={onDismiss}
    >
      <AppText variant="h2" accessibilityRole="header">
        {title}
      </AppText>
      {kind === 'type' ? <TypeOptions draft={draft} onChange={update} /> : null}
      {kind === 'difficulty' ? <DifficultyOptions draft={draft} onChange={update} /> : null}
      {kind === 'distance' ? <DistanceOptions draft={draft} onChange={update} /> : null}
      <AppButton
        testID="explore.filter.apply"
        label={t('places.filter.apply')}
        onPress={() => onApply(draft)}
      />
    </Sheet>
  );
}

type OptionsProps = { draft: ExploreFilters; onChange: (next: ExploreFilters) => void };

function TypeOptions({ draft, onChange }: OptionsProps) {
  const toggle = (type: PlaceType) => {
    const types = draft.types.includes(type)
      ? draft.types.filter(item => item !== type)
      : TYPES.filter(item => item === type || draft.types.includes(item));
    onChange({ ...draft, types });
  };
  return (
    <View style={layout.wrap}>
      {TYPES.map(type => (
        <Option
          key={type}
          testID={`explore.filter-option.type-${type}`}
          label={t(`places.typePlural.${type}`)}
          selected={draft.types.includes(type)}
          onPress={() => toggle(type)}
        />
      ))}
    </View>
  );
}

function DifficultyOptions({ draft, onChange }: OptionsProps) {
  const range = draft.difficulty ?? FULL_RANGE;
  const set = (next: DifficultyRange) =>
    onChange({ ...draft, difficulty: next.min === 1 && next.max === 5 ? null : next });
  return (
    <View style={layout.section}>
      {(['min', 'max'] as const).map(edge => (
        <View key={edge} style={layout.section}>
          <AppText variant="caption">{t(`places.filter.${edge}`)}</AppText>
          <View style={layout.wrap}>
            {DIFFICULTY_LEVELS.map(level => (
              <Option
                key={level}
                testID={`explore.filter-option.difficulty-${edge}-${level}`}
                label={String(level)}
                selected={range[edge] === level}
                onPress={() =>
                  set(
                    edge === 'min'
                      ? { min: level, max: Math.max(level, range.max) }
                      : { min: Math.min(level, range.min), max: level },
                  )
                }
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function DistanceOptions({ draft, onChange }: OptionsProps) {
  return (
    <View style={layout.wrap}>
      {DISTANCE_OPTIONS.map(km => (
        <Option
          key={km ?? 'any'}
          testID={`explore.filter-option.distance-${km ?? 'any'}`}
          label={km === null ? t('places.filter.any') : t('places.filter.maxKm', { km })}
          selected={draft.maxKm === km}
          onPress={() => onChange({ ...draft, maxKm: km })}
        />
      ))}
    </View>
  );
}

type OptionProps = { testID: string; label: string; selected: boolean; onPress: () => void };

function Option({ testID, label, selected, onPress }: OptionProps) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.selected]}
    >
      <AppText variant="chip" tone={selected ? 'white' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
  section: { gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  option: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  selected: { backgroundColor: c.teal700, borderColor: c.teal700 },
}));
