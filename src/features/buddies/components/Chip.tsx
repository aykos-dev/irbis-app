import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  testID: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** A selectable filter pill (level, weekend, region, interests, free days). */
export function Chip({ testID, label, selected, disabled, onPress }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.chip, selected ? styles.chipOn : null]}
    >
      <AppText variant="chip" tone={selected ? 'white' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

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
