import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';

type Props = {
  /** Irbis art (a `Motion` or `Mascot`) at the bubble's left. */
  mascot: ReactElement;
  text: string;
};

/** Irbis with a speech bubble, the opening row of the Experience and Interests steps. */
export function IrbisBubble({ mascot, text }: Props) {
  const styles = useStyles();
  return (
    <View style={layout.row}>
      {mascot}
      <View style={styles.bubble}>
        <AppText variant="h3">{text}</AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[10] },
});

const useStyles = createThemedStyles(c => ({
  bubble: {
    flex: 1,
    marginBottom: spacing[22],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
}));
