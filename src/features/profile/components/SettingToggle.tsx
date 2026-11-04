import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';

export function SettingToggle({
  testID,
  label,
  value,
  disabled = false,
  onChange,
}: {
  testID: string;
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={layout.row}
    >
      <AppText variant="body" style={layout.label}>
        {label}
      </AppText>
      <View
        style={[
          layout.track,
          value ? styles.on : styles.off,
          disabled ? layout.disabled : null,
        ]}
      >
        <View
          style={[layout.knob, styles.knob, value ? layout.knobOn : null]}
        />
      </View>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  label: { flex: 1 },
  track: { width: 48, height: 28, borderRadius: radii.pill, padding: 3 },
  knob: { width: 22, height: 22, borderRadius: 11 },
  knobOn: { transform: [{ translateX: 20 }] },
  disabled: { opacity: 0.5 },
});

const useStyles = createThemedStyles(c => ({
  on: { backgroundColor: c.teal },
  off: { backgroundColor: c.line },
  knob: { backgroundColor: c.white },
}));
