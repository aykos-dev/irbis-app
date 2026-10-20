import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { CompanionReaction } from '../components/CompanionReaction';
import { GoalRing } from '../components/GoalRing';
import { useCompanionLevel } from '../hooks/useCompanionLevel';
import { useHearts } from '../hooks/useHearts';
import { useLessonsCatalog } from '../hooks/useLessonsCatalog';
import { burstColors } from '../lessonColors';
import { sounds } from '../sounds';
import { progressOf } from './LessonsHubScreen';

const COMPANION = 120;
const BURST = 220;
const RAY_WIDTH = 10;
const RAY_LENGTH = 34;
const BURST_MS = 700;
const RAY_ANGLE = 360 / burstColors.length;

/** Rays bursting out from behind the companion (placeholder celebration, owner Q11). */
function Burst() {
  const reduceMotion = useReducedMotion();
  const spread = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) {
      spread.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) });
    }
  }, [reduceMotion, spread]);

  const style = useAnimatedStyle(() => ({ opacity: spread.value, transform: [{ scale: spread.value }] }));

  return (
    <Animated.View style={[layout.burst, style]} importantForAccessibility="no-hide-descendants">
      {burstColors.map((color, i) => (
        <View key={color + String(i)} style={[layout.rayWrap, { transform: [{ rotate: `${RAY_ANGLE * i}deg` }] }]}>
          <View style={[layout.ray, { backgroundColor: color }]} />
        </View>
      ))}
    </Animated.View>
  );
}

/** After the last right answer (AC7): XP line, first-try count, hearts and the daily goal. */
export function LessonCompleteScreen({ navigation, route }: RootStackScreenProps<'LessonComplete'>) {
  const { practice, perfect, firstTry, total } = route.params;
  const { status } = useAuth();
  const { hearts, day } = useHearts();
  const { data: catalog } = useLessonsCatalog();
  const companion = useCompanionLevel();
  const requireAccount = useRequireAccount('xp');

  useEffect(() => {
    haptics.success();
    sounds.play('complete');
  }, []);

  const toHub = () => navigation.goBack();
  const xp = catalog ? (perfect ? catalog.config.xpPerfect : catalog.config.xpFirst) : 0;
  const goal = catalog ? progressOf(catalog, day).doneToday : 0;

  return (
    <Screen testID="lesson.complete" scroll>
      <View style={layout.hero}>
        <Burst />
        <CompanionReaction level={companion} cheering size={COMPANION} />
      </View>
      <AppText variant="h1" accessibilityRole="header" style={layout.center}>
        {t('lessons.complete.title')}
      </AppText>
      <View testID="lesson.complete.xp" style={layout.lines}>
        {practice ? (
          <AppText variant="h3" tone="muted" style={layout.center}>
            {t('lessons.complete.practice')}
          </AppText>
        ) : (
          <>
            <AppText variant="h2" tone="ink" style={layout.center}>
              {t('lessons.complete.xp', { count: xp })}
            </AppText>
            {perfect ? (
              <AppText variant="body" tone="teal700" style={layout.center}>
                {t('lessons.complete.perfect')}
              </AppText>
            ) : null}
          </>
        )}
      </View>
      <View style={layout.lines}>
        <AppText testID="lesson.complete.firstTry" variant="body" style={layout.center}>
          {t('lessons.complete.firstTry', { n: firstTry, total })}
        </AppText>
        <AppText testID="lesson.complete.hearts" variant="body" style={layout.center}>
          {t('lessons.complete.hearts', { count: hearts })}
        </AppText>
      </View>
      {catalog ? <GoalRing done={goal} target={catalog.config.dailyGoal} /> : null}
      <View style={layout.actions}>
        <AppButton testID="lesson.complete.continue" label={t('lessons.quiz.continue')} onPress={toHub} />
        {status === 'guest' && !practice ? (
          <AppButton
            testID="lesson.complete.signup"
            label={t('lessons.complete.signup')}
            variant="white"
            onPress={() => requireAccount(toHub)}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const layout = StyleSheet.create({
  hero: { height: BURST, alignItems: 'center', justifyContent: 'center', marginTop: spacing[24] },
  burst: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  rayWrap: { position: 'absolute', width: BURST, height: BURST, alignItems: 'center' },
  ray: { width: RAY_WIDTH, height: RAY_LENGTH, borderRadius: radii.pill },
  center: { textAlign: 'center' },
  lines: { gap: spacing[4], paddingTop: spacing[14] },
  actions: { gap: spacing[12], paddingTop: spacing[24], paddingBottom: spacing[16] },
});
