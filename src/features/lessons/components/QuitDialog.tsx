import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

type Props = { closing: boolean; onQuit: () => void; onKeep: () => void; onDismiss: () => void };

/** Close X on the quiz (AC5): quitting drops this run. */
export function QuitDialog({ closing, onQuit, onKeep, onDismiss }: Props) {
  return (
    <Sheet testID="quiz.quit" accessibilityLabel={t('lessons.quiz.quitTitle')} closing={closing} onDismiss={onDismiss}>
      <View style={styles.text}>
        <AppText variant="h2" accessibilityRole="header" style={styles.center}>
          {t('lessons.quiz.quitTitle')}
        </AppText>
        <AppText variant="body" tone="muted" style={styles.center}>
          {t('lessons.quiz.quitBody')}
        </AppText>
      </View>
      <AppButton testID="quiz.quit.confirm" label={t('lessons.quiz.quit')} variant="danger" onPress={onQuit} />
      <AppButton testID="quiz.quit.keep" label={t('lessons.quiz.keep')} variant="white" onPress={onKeep} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  text: { gap: spacing[8] },
  center: { textAlign: 'center' },
});
