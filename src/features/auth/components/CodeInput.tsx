import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import type { TextInputHandle } from '../../../shared/components/TextField';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { CODE_DIGITS, digitsOnly } from '../schemas';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  testID?: string;
  label: string;
  error?: string;
  autoFocus?: boolean;
  inputRef?: Ref<TextInputHandle>;
};

const BOXES = Array.from({ length: CODE_DIGITS }, (_, index) => index);

/**
 * Canvas AccReset: six boxes over one hidden input, so SMS autofill (`oneTimeCode`), paste and the
 * numeric keypad all work on one real field. The box under the cursor takes the teal state.
 */
export function CodeInput({
  value,
  onChangeText,
  onSubmitEditing,
  testID = 'auth.code',
  label,
  error,
  autoFocus,
  inputRef,
}: Props) {
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_DIGITS - 1);

  return (
    <View style={layout.wrap}>
      <View style={layout.field} accessibilityLabel={label} accessibilityRole="none">
        <View style={layout.boxes} pointerEvents="none" accessibilityElementsHidden>
          {BOXES.map(index => (
            <View
              key={index}
              style={[
                layout.box,
                styles.box,
                error ? styles.boxError : focused && index === active ? styles.boxActive : null,
              ]}
            >
              <AppText variant="h2">{value[index] ?? ''}</AppText>
            </View>
          ))}
        </View>
        <TextInput
          ref={inputRef}
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={text => onChangeText(digitsOnly(text).slice(0, CODE_DIGITS))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_DIGITS}
          returnKeyType="next"
          autoFocus={autoFocus}
          caretHidden
          style={layout.input}
        />
      </View>
      {error ? (
        <AppText
          variant="small"
          testID={`${testID}-error`}
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[8] },
  field: { minHeight: sizes.otpBoxHeight },
  boxes: { flexDirection: 'row', gap: spacing[8] },
  box: {
    flex: 1,
    height: sizes.otpBoxHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderRadius: radii.input,
  },
  input: { ...StyleSheet.absoluteFill, opacity: 0.02 },
});

const useStyles = createThemedStyles(c => ({
  box: { backgroundColor: c.card, borderColor: c.line },
  boxActive: { backgroundColor: c.navActiveBg, borderColor: c.teal },
  boxError: { borderColor: c.red700 },
  error: { color: c.red700 },
}));
