import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { TextField } from '../../../shared/components/TextField';
import { spacing } from '../../../shared/constants/spacing';

type Props = {
  testID: string;
  title: string;
  body?: string;
  label: string;
  inputTestID: string;
  submitTestID: string;
  submitLabel: string;
  maxLength: number;
  /** An empty value is allowed (optional note). */
  optional?: boolean;
  optionalLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  /** Return true to close the sheet. */
  onSubmit: (value: string) => Promise<boolean> | boolean;
  onDismiss: () => void;
};

/** One text field + one action in a sheet: custom gear item, join note. */
export function TextSheet({
  testID,
  title,
  body,
  label,
  inputTestID,
  submitTestID,
  submitLabel,
  maxLength,
  optional = false,
  optionalLabel,
  loading = false,
  disabled = false,
  error,
  onSubmit,
  onDismiss,
}: Props) {
  const [value, setValue] = useState('');
  const [closing, setClosing] = useState(false);
  const submit = async () => {
    if (await onSubmit(value.trim())) {
      setClosing(true);
    }
  };
  return (
    <Sheet testID={testID} accessibilityLabel={title} closing={closing} onDismiss={onDismiss}>
      <View style={layout.form}>
        <AppText variant="h2" accessibilityRole="header">
          {title}
        </AppText>
        {body ? (
          <AppText variant="body" tone="muted">
            {body}
          </AppText>
        ) : null}
        <TextField
          testID={inputTestID}
          label={label}
          optionalLabel={optional ? optionalLabel : undefined}
          value={value}
          onChangeText={setValue}
          maxLength={maxLength}
          error={error ?? undefined}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <AppButton
          testID={submitTestID}
          label={submitLabel}
          loading={loading}
          disabled={disabled || (!optional && value.trim() === '')}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  form: { gap: spacing[16] },
});
