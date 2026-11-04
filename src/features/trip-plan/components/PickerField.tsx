import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  testID: string;
  /** Visible value ("07:00", "Sat, 25 Oct"). */
  text: string;
  accessibilityLabel: string;
  mode: 'date' | 'time';
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (value: Date) => void;
};

/**
 * A value pill that opens the native picker (AC2). Android shows its dialog and closes on set or
 * cancel; iOS shows the spinner under the pill until the pill is pressed again.
 */
export function PickerField({ testID, text, accessibilityLabel, mode, value, minimumDate, maximumDate, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const styles = useStyles();
  const isAndroid = Platform.OS === 'android';

  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    if (isAndroid) {
      setOpen(false);
    }
    if (event.type === 'set' && picked) {
      haptics.selection();
      onChange(picked);
    }
  };

  return (
    <View style={layout.wrap}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          haptics.tap();
          setOpen(current => !current);
        }}
        style={styles.pill}
      >
        <AppText variant="h3">{text}</AppText>
      </Pressable>
      {open ? (
        <DateTimePicker
          testID={`${testID}.picker`}
          value={value}
          mode={mode}
          display={isAndroid ? 'default' : 'spinner'}
          is24Hour
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  pill: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
