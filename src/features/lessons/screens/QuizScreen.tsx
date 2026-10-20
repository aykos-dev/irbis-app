import { StyleSheet } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { spacing } from '../../../shared/constants/spacing';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useLessonsCatalog } from '../hooks/useLessonsCatalog';

/** Quiz route (lessons slice 3 builds the quiz); for now it shows the lesson's title. */
export function QuizScreen({ route }: RootStackScreenProps<'Quiz'>) {
  const locale = useLocale();
  const { data } = useLessonsCatalog();
  const lesson = data?.tiers.flatMap(tier => tier.lessons).find(item => item.id === route.params.lessonId);
  return (
    <Screen testID="quiz.screen">
      <AppText testID="quiz.title" variant="h2" accessibilityRole="header" style={styles.title}>
        {lesson?.title[locale] ?? ''}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing[16] },
});
