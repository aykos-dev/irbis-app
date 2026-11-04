import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { spacing } from '../../../shared/constants/spacing';
import {
  MAX_BACK_DAYS,
  addDays,
  formatClock,
  formatDay,
  fromPickerDate,
  toInstant,
  toPickerDate,
  type Clock,
} from '../tripTimes';
import { PickerField } from './PickerField';

type Props = {
  testID: string;
  label: string;
  day: string;
  clock: Clock;
  locale: string;
  onClockChange: (clock: Clock) => void;
  /** Back-by only: a later day for overnight trips (start day … +3 days). */
  dayPicker?: { minDay: string; onDayChange: (day: string) => void };
};

/** Start / Back-by row (AC2): native time picker, Back-by also a day picker. */
export function TimeRow({ testID, label, day, clock, locale, onClockChange, dayPicker }: Props) {
  const time = formatClock(toInstant(day, clock), locale);
  return (
    <View style={layout.row}>
      <AppText variant="body" tone="ink" style={layout.label}>
        {label}
      </AppText>
      {dayPicker ? (
        <PickerField
          testID={`${testID}-day`}
          text={formatDay(day, locale)}
          accessibilityLabel={`${label} ${formatDay(day, locale)}`}
          mode="date"
          value={toPickerDate(day, clock)}
          minimumDate={toPickerDate(dayPicker.minDay, clock)}
          maximumDate={toPickerDate(addDays(dayPicker.minDay, MAX_BACK_DAYS), clock)}
          onChange={value => dayPicker.onDayChange(fromPickerDate(value).day)}
        />
      ) : null}
      <PickerField
        testID={testID}
        text={time}
        accessibilityLabel={`${label} ${time}`}
        mode="time"
        value={toPickerDate(day, clock)}
        onChange={value => onClockChange(fromPickerDate(value).clock)}
      />
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[8], flexWrap: 'wrap' },
  label: { flex: 1, paddingTop: spacing[10] },
});
