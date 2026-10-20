import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { radii, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { t } from '../../../shared/i18n';
import { quizColors } from '../lessonColors';

const MARK = 44;
const MARK_ICON = 24;
const MARK_STROKE = 3.4;
const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const CROSS_PATH = 'M7 7l10 10M17 7L7 17';

type Props =
  | { kind: 'correct'; explanation: string; onContinue: () => void }
  | {
      kind: 'wrong';
      practice: boolean;
      correctText: string;
      explanation: string;
      onContinue: () => void;
    };

/** The answer panel in place of Check (AC5): "Nicely done!" or "Not quite", then Continue / Got it. */
export function AnswerSheet(props: Props) {
  const insets = useSafeAreaInsets();
  const correct = props.kind === 'correct';
  const colors = correct ? quizColors.correctSheet : quizColors.wrongSheet;
  let title = t('lessons.quiz.correct');
  if (props.kind === 'wrong') {
    title = props.practice ? t('lessons.quiz.wrongPractice') : t('lessons.quiz.wrong');
  }
  return (
    <View
      testID={correct ? 'quiz.sheet.correct' : 'quiz.sheet.wrong'}
      accessibilityLiveRegion="polite"
      style={[styles.sheet, { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, spacing[28]) }]}
    >
      <View style={styles.head}>
        <View style={[styles.mark, { backgroundColor: colors.mark }]}>
          <Svg viewBox="0 0 24 24" width={MARK_ICON} height={MARK_ICON}>
            <Path
              d={correct ? CHECK_PATH : CROSS_PATH}
              stroke={quizColors.onMark}
              strokeWidth={MARK_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <AppText variant="h2" accessibilityRole="header" style={[styles.title, { color: colors.title }]}>
          {title}
        </AppText>
      </View>
      {props.kind === 'wrong' ? (
        <AppText variant="body" style={[styles.answer, { color: colors.body }]}>
          {`${t('lessons.quiz.correctAnswer')} `}
          <AppText variant="body" style={[styles.bold, { color: colors.body }]}>
            {props.correctText}
          </AppText>
        </AppText>
      ) : null}
      <AppText variant="body" style={{ color: colors.body }}>
        {props.explanation}
      </AppText>
      <AppButton
        testID="quiz.continue"
        label={correct ? t('lessons.quiz.continue') : t('lessons.quiz.gotIt')}
        variant={correct ? 'primary' : 'danger'}
        onPress={props.onContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: spacing[12],
    paddingTop: spacing[18],
    paddingHorizontal: spacing[20],
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  mark: { width: MARK, height: MARK, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  answer: { fontFamily: fontFamily.extraBold },
  bold: { fontFamily: fontFamily.black },
});
