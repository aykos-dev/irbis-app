import { StyleSheet, View } from 'react-native';

import { radii } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { quizColors } from '../lessonColors';

const HEIGHT = 16;
const SHINE = 4;

type Props = { right: number; total: number };

/** Quiz progress: questions answered right out of all (AC5). */
export function ProgressBar({ right, total }: Props) {
  const fraction = total > 0 ? Math.min(right / total, 1) : 0;
  return (
    <View
      testID="quiz.progress"
      style={styles.track}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('lessons.quiz.progressA11y', { n: Math.min(right + 1, total), total })}
      accessibilityValue={{ min: 0, max: total, now: right }}
    >
      <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: quizColors.progressTrack,
    overflow: 'hidden',
  },
  fill: {
    height: HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: quizColors.progressFill,
    borderBottomWidth: SHINE,
    borderBottomColor: quizColors.progressFillEdge,
  },
});
