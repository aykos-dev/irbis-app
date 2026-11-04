import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { DEFAULT_START, PLAN_AHEAD_DAYS, addDays, formatDay, fromPickerDate, toPickerDate } from '../tripTimes';

type Props = {
  day: string;
  today: string;
  sat: string;
  sun: string;
  locale: string;
  onChange: (day: string) => void;
};

/** When (AC2): next Sat · next Sun · Other → native date picker (today … +14 days). */
export function WhenPicker({ day, today, sat, sun, locale, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const isAndroid = Platform.OS === 'android';
  const isOther = day !== sat && day !== sun;

  const pick = (next: string) => {
    haptics.selection();
    onChange(next);
  };

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (isAndroid) {
      setOpen(false);
    }
    if (event.type === 'set' && picked) {
      pick(fromPickerDate(picked).day);
    }
  };

  return (
    <View style={layout.wrap}>
      <AppText variant="caption">{t('trip.when')}</AppText>
      <View style={layout.chips}>
        <Chip testID="trip.date.sat" label={`${t('trip.sat')} · ${formatDay(sat, locale)}`} selected={day === sat} onPress={() => pick(sat)} />
        <Chip testID="trip.date.sun" label={`${t('trip.sun')} · ${formatDay(sun, locale)}`} selected={day === sun} onPress={() => pick(sun)} />
        <Chip
          testID="trip.date.other"
          label={isOther ? formatDay(day, locale) : t('trip.other')}
          accessibilityLabel={isOther ? formatDay(day, locale) : t('trip.pickDate')}
          selected={isOther}
          onPress={() => {
            haptics.tap();
            setOpen(current => !current);
          }}
        />
      </View>
      {open ? (
        <DateTimePicker
          testID="trip.date.picker"
          value={toPickerDate(day, DEFAULT_START)}
          mode="date"
          display={isAndroid ? 'default' : 'inline'}
          minimumDate={toPickerDate(today, DEFAULT_START)}
          maximumDate={toPickerDate(addDays(today, PLAN_AHEAD_DAYS), DEFAULT_START)}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

type ChipProps = {
  testID: string;
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ testID, label, accessibilityLabel, selected, onPress }: ChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : null]}
    >
      <AppText variant="chip" tone={selected ? 'white' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[8] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  chip: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: c.teal700, borderColor: c.teal700 },
}));
