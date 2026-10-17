import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut } from 'react-native-reanimated';

import { borders, motion, radii, spacing } from '../constants/spacing';
import { createThemedStyles, useTheme } from '../contexts/theme';
import { haptics } from '../utils/haptics';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  testID: string;
  error?: string;
};

const BOX = 26;
const entering = FadeIn.duration(motion.press).easing(Easing.out(Easing.cubic));
const exiting = FadeOut.duration(motion.press).easing(Easing.in(Easing.cubic));

/** Canvas checkbox (AccSignup .box): 26 px, radius 8, teal when checked. */
export function Checkbox({ checked, onChange, label, testID, error }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={layout.wrap}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        hitSlop={spacing[8]}
        onPress={() => {
          haptics.selection();
          onChange(!checked);
        }}
        style={layout.row}
      >
        <View style={[layout.box, checked ? styles.boxOn : error ? styles.boxError : styles.boxOff]}>
          {checked ? (
            <Animated.View entering={entering} exiting={exiting}>
              <Icon name="check" color={colors.white} size={18} />
            </Animated.View>
          ) : null}
        </View>
        <AppText variant="small" tone="body" style={layout.label}>
          {label}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="small" testID={`${testID}-error`} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[6] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[12] },
  box: {
    width: BOX,
    height: BOX,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, paddingTop: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  boxOn: { backgroundColor: c.teal },
  boxOff: { backgroundColor: c.card, borderWidth: borders.card, borderColor: c.line },
  boxError: { backgroundColor: c.card, borderWidth: borders.card, borderColor: c.red700 },
  error: { color: c.red700 },
}));
