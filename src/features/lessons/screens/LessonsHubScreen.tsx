import { useIsFocused } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MainTabScreenProps } from '../../../app/navigation/types';
import type { CatalogLesson, LessonCatalog } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { catalogStore } from '../catalogStore';
import { GoalRing } from '../components/GoalRing';
import { HeartsCount } from '../components/HeartsCount';
import { OutOfHeartsSheet } from '../components/OutOfHeartsSheet';
import { TierCard } from '../components/TierCard';
import { heartsStore } from '../heartsStore';
import { useHearts } from '../hooks/useHearts';
import { useLessonsCatalog } from '../hooks/useLessonsCatalog';
import { tashkentDay } from '../tashkentDay';

const SKELETON_GOAL = 104;
const SKELETON_TIER = 240;

type Progress = { done: ReadonlySet<string>; doneToday: number };

/**
 * Done set = server completions ∪ local ones; today's count = server `doneToday` + local first
 * completions dated today (Tashkent) that the server does not know yet.
 */
export function progressOf(catalog: LessonCatalog, day: string): Progress {
  const server = new Set(catalog.progress?.completedLessonIds ?? []);
  const local = catalogStore.localCompletions();
  const localToday = local.filter(
    entry => !server.has(entry.lessonId) && tashkentDay(Date.parse(entry.completedAt)) === day,
  );
  const done = new Set([...server, ...local.map(entry => entry.lessonId)]);
  return { done, doneToday: (catalog.progress?.doneToday ?? 0) + localToday.length };
}

/** The first not-done lesson in tier order, for the START pill. */
function startLessonId(catalog: LessonCatalog, done: ReadonlySet<string>): string | undefined {
  const tiers = [...catalog.tiers].sort((a, b) => a.order - b.order);
  for (const tier of tiers) {
    const next = [...tier.lessons].sort((a, b) => a.order - b.order).find(lesson => !done.has(lesson.id));
    if (next) {
      return next.id;
    }
  }
  return undefined;
}

/** Lessons tab (AC4): hearts, daily goal and every tier with its lessons. */
export function LessonsHubScreen({ navigation }: MainTabScreenProps<'Lessons'>) {
  const locale = useLocale();
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { hearts, day } = useHearts();
  const query = useLessonsCatalog();
  // Re-render on return from a lesson so its local completion shows (done set, goal ring).
  useIsFocused();
  const [sheet, setSheet] = useState<'open' | 'closing' | null>(null);

  const open = (lesson: CatalogLesson, done: boolean) => {
    if (!done && heartsStore.hearts() === 0) {
      haptics.warning();
      setSheet('open');
      return;
    }
    haptics.tap();
    navigation.navigate('Quiz', { lessonId: lesson.id });
  };
  const retry = () => void query.refetch();

  let body;
  if (query.data) {
    body = <HubBody catalog={query.data} day={day} locale={locale} onOpen={open} />;
  } else if (query.error) {
    body = (
      <ErrorState
        testID="lessons.error"
        retryTestID="lessons.error.retry"
        title={t('lessons.error')}
        error={query.error}
        onRetry={retry}
      />
    );
  } else if (!isOnline && status !== 'loading') {
    body = (
      <View testID="lessons.offline" style={layout.section}>
        <AppText variant="body">{t('lessons.offline')}</AppText>
        <AppButton testID="lessons.offline.retry" label={t('lessons.retry')} variant="white" onPress={retry} />
      </View>
    );
  } else {
    body = (
      <View testID="lessons.skeleton" style={layout.section}>
        <Skeleton height={SKELETON_GOAL} radius={radii.card} />
        <Skeleton height={SKELETON_TIER} radius={radii.card} />
        <Skeleton height={SKELETON_TIER} radius={radii.card} />
      </View>
    );
  }

  return (
    <Screen testID="lessons.hub" scroll bottomInset={false}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('lessons.hub.title')}
        </AppText>
        <HeartsCount hearts={hearts} />
      </View>
      {body}
      {sheet ? (
        <OutOfHeartsSheet
          msLeft={heartsStore.msUntilReset()}
          closing={sheet === 'closing'}
          onOk={() => setSheet('closing')}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}

type BodyProps = {
  catalog: LessonCatalog;
  day: string;
  locale: Locale;
  onOpen: (lesson: CatalogLesson, done: boolean) => void;
};

function HubBody({ catalog, day, locale, onOpen }: BodyProps) {
  if (catalog.tiers.length === 0) {
    return (
      <EmptyState testID="lessons.empty" mascot="default" mascotLabel={t('lessons.empty')} title={t('lessons.empty')} />
    );
  }
  const { done, doneToday } = progressOf(catalog, day);
  const startId = startLessonId(catalog, done);
  const tiers = [...catalog.tiers].sort((a, b) => a.order - b.order);
  return (
    <>
      <GoalRing done={doneToday} target={catalog.config.dailyGoal} />
      {tiers.map(tier => (
        <TierCard
          key={tier.key}
          tier={tier}
          locale={locale}
          done={done}
          startId={startId}
          onOpen={lesson => onOpen(lesson, done.has(lesson.id))}
        />
      ))}
    </>
  );
}

const layout = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[16],
  },
  section: { gap: spacing[14] },
});
