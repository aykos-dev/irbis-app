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
  text: string;
  accessibilityLabel: string;
  mode: 'date' | 'time';
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  onChange: (value: Date) => void;
};

/** A value pill that opens the native date / time picker (Android dialog, iOS spinner below). */
export function PickerField({ testID, text, accessibilityLabel, mode, value, minimumDate, maximumDate, disabled, onChange }: Props) {
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
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
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
