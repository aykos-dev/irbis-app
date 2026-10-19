import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { joinSizes } from '../campTheme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  editable: boolean;
};

const BOXES = Array.from({ length: joinSizes.codeDigits }, (_, index) => index);

/** Four digit boxes over one hidden numeric input (canvas CampJoin). */
export function RoomCodeInput({ value, onChangeText, label, editable }: Props) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, joinSizes.codeDigits - 1);

  return (
    <View style={layout.field}>
      <View style={layout.boxes} pointerEvents="none" accessibilityElementsHidden>
        {BOXES.map(index => (
          <View
            key={index}
            style={[layout.box, styles.box, focused && index === active ? styles.boxActive : null]}
          >
            <AppText variant="h2">{value[index] ?? ''}</AppText>
          </View>
        ))}
      </View>
      <TextInput
        testID="camp.join.code"
        accessibilityLabel={label}
        value={value}
        editable={editable}
        onChangeText={text => onChangeText(text.replace(/\D/g, '').slice(0, joinSizes.codeDigits))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={joinSizes.codeDigits}
        caretHidden
        style={layout.input}
      />
    </View>
  );
}

const layout = StyleSheet.create({
  field: { alignSelf: 'center', height: joinSizes.codeBox },
  boxes: { flexDirection: 'row', gap: spacing[12] },
  box: {
    width: joinSizes.codeBox,
    height: joinSizes.codeBox,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.card,
    borderRadius: radii.input,
  },
  input: { ...StyleSheet.absoluteFill, opacity: 0.02 },
});

const useStyles = createThemedStyles(c => ({
  box: { backgroundColor: c.card, borderColor: c.line },
  boxActive: { borderColor: c.orange },
}));
