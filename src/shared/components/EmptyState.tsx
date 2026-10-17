import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { motion, spacing } from '../constants/spacing';
import { AppText } from './AppText';
import { Mascot, type MascotKind } from './Mascot';

type Props = {
  testID: string;
  mascot: MascotKind;
  mascotLabel: string;
  title: string;
  body?: string;
  /** Primary action where one exists (engineering-standards §11). */
  action?: ReactNode;
  /** Size to content at the top instead of filling and centring (e.g. inside a part-visible sheet). */
  inline?: boolean;
};

const entering = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));

/** Empty state: mascot, one-line explanation, optional primary action. */
export function EmptyState({ testID, mascot, mascotLabel, title, body, action, inline = false }: Props) {
  return (
    <Animated.View testID={testID} entering={entering} style={inline ? styles.inline : styles.root}>
      <Mascot kind={mascot} size={SIZE} accessibilityLabel={mascotLabel} />
      <View style={styles.text} accessible accessibilityRole="summary">
        <AppText variant="h2" style={styles.center} accessibilityRole="header">
          {title}
        </AppText>
        {body ? (
          <AppText variant="body" tone="muted" style={styles.center}>
            {body}
          </AppText>
        ) : null}
      </View>
      {action}
    </Animated.View>
  );
}

const SIZE = 160;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[16],
    paddingHorizontal: spacing[24],
  },
  inline: {
    alignItems: 'center',
    gap: spacing[16],
    paddingHorizontal: spacing[24],
    paddingVertical: spacing[16],
  },
  text: { gap: spacing[8], alignItems: 'center' },
  center: { textAlign: 'center' },
});
