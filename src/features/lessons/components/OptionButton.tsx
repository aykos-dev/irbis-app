import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { quizColors } from '../lessonColors';

const KEY = 32;
const KEYS = ['A', 'B', 'C', 'D'] as const;

export type OptionState = 'idle' | 'picked' | 'correct' | 'wrong';

type Props = {
  index: number;
  text: string;
  state: OptionState;
  disabled: boolean;
  onPress: () => void;
};

/** One answer option: key circle "A"–"D" + text, wraps (LAYOUT.md § Quiz). */
export function OptionButton({ index, text, state, disabled, onPress }: Props) {
  const styles = useStyles();
  const tint = state === 'idle' ? undefined : quizColors[state];
  const key = KEYS[index] ?? String(index + 1);
  return (
    <Pressable
      testID={`quiz.option.${index}`}
      accessibilityRole="radio"
      accessibilityLabel={`${key}. ${text}`}
      accessibilityState={{ selected: state !== 'idle', disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, tint && { backgroundColor: tint.bg, borderColor: tint.border }]}
    >
      <View style={[styles.key, tint && { borderColor: tint.border }]}>
        <AppText variant="chip" style={[styles.keyText, tint && { color: tint.text }]}>
          {key}
        </AppText>
      </View>
      <AppText variant="body" tone="ink" style={[layout.text, tint && { color: tint.text }]}>
        {text}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  text: { flex: 1, fontFamily: fontFamily.extraBold },
});

const useStyles = createThemedStyles(c => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  key: {
    width: KEY,
    height: KEY,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: c.muted, fontFamily: fontFamily.black },
}));
