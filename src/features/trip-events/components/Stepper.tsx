import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  testID: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

/** − value + for a bounded whole number. */
export function Stepper({ testID, label, value, min, max, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  };
  return (
    <View testID={testID} style={layout.row} accessibilityLabel={`${label} ${value}`}>
      <Pressable
        testID={`${testID}-minus`}
        accessibilityRole="button"
        accessibilityLabel={t('tripEvents.create.decrease', { label })}
        disabled={value <= min}
        onPress={() => step(-1)}
        style={styles.button}
      >
        <AppText variant="h3" tone="ink">
          −
        </AppText>
      </Pressable>
      <AppText testID={`${testID}-value`} variant="h3" style={layout.value}>
        {value}
      </AppText>
      <Pressable
        testID={`${testID}-plus`}
        accessibilityRole="button"
        accessibilityLabel={t('tripEvents.create.increase', { label })}
        disabled={value >= max}
        onPress={() => step(1)}
        style={styles.button}
      >
        <Icon name="plus" color={colors.ink} />
      </Pressable>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  value: { minWidth: sizes.touchTarget, textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
