import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { RootStackParamList, RootStackScreenProps } from '../../../app/navigation/types';
import type { LessonCatalog, PublicLesson, PublicQuestion } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { completionsStore } from '../completionsStore';
import { AnswerSheet } from '../components/AnswerSheet';
import { CompanionReaction } from '../components/CompanionReaction';
import { LessonGlyph } from '../components/LessonGlyph';
import { OptionButton, type OptionState } from '../components/OptionButton';
import { OutOfHeartsSheet } from '../components/OutOfHeartsSheet';
import { ProgressBar } from '../components/ProgressBar';
import { QuitDialog } from '../components/QuitDialog';
import { heartsStore } from '../heartsStore';
import { useCompanionLevel } from '../hooks/useCompanionLevel';
import { useHearts } from '../hooks/useHearts';
import { useLesson } from '../hooks/useLesson';
import { useLessonsCatalog } from '../hooks/useLessonsCatalog';
import { glyphColors, heartColor, quizColors, tierTint } from '../lessonColors';
import { answer, currentIndex, firstTryCount, isPerfect, next, startQuiz, type QuizState } from '../quizMachine';
import { sounds } from '../sounds';

const ICON = 24;
const HEART = 26;
const HEART_COUNT_SIZE = 17;
const CLOSE_STROKE = 3;
const BROKEN_STROKE = 2;
const CHIP_HEIGHT = 30;
const CHIP_GLYPH = 16;
const PROMPT_SIZE = 24;
const PROMPT_LINE = 30;
const IMAGE_MAX = 200;
const COMPANION = 72;
const HEART_PATH = 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z';
const BROKEN_PATH = 'M12 7.5l-1.5 4 3 2-1.5 4';
const CLOSE_PATH = 'M6 6l12 12M18 6L6 18';
const SPEAKER_PATH = 'M4 9h4l5-4v14l-5-4H4z';
const WAVES_PATH = 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11';
const MUTED_PATH = 'M16 9l5 6M21 9l-5 6';

type Exit = { to: 'back' } | { to: 'complete'; params: RootStackParamList['LessonComplete'] };
type SheetState = 'open' | 'closing' | null;

/** Where the lesson sits in the catalog: its tier title and icon, and whether it is done. */
function catalogEntry(catalog: LessonCatalog | undefined, lessonId: string) {
  for (const tier of catalog?.tiers ?? []) {
    const lesson = tier.lessons.find(item => item.id === lessonId);
    if (lesson) {
      return { tier, lesson };
    }
  }
  return undefined;
}

/** A lesson already done (server progress ∪ local completions) replays as practice (AC6). */
function isDone(catalog: LessonCatalog | undefined, lessonId: string): boolean {
  return (
    (catalog?.progress?.completedLessonIds.includes(lessonId) ?? false) ||
    completionsStore.all().some(entry => entry.lessonId === lessonId)
  );
}

/** One lesson's quiz (AC5, AC6): questions in admin order, wrong ones re-asked at the end. */
export function QuizScreen({ navigation, route }: RootStackScreenProps<'Quiz'>) {
  const { lessonId } = route.params;
  const locale = useLocale();
  const { data: catalog } = useLessonsCatalog();
  const { lesson, query } = useLesson(lessonId);
  const entry = catalogEntry(catalog, lessonId);
  const [run, setRun] = useState<QuizState | null>(null);
  const [exit, setExit] = useState<Exit | null>(null);
  const [quit, setQuit] = useState<SheetState>(null);
  const [outOfHearts, setOutOfHearts] = useState<SheetState>(null);
  const [muted, setMuted] = useState(sounds.muted);

  useEffect(() => {
    void sounds.load();
  }, []);

  useEffect(() => {
    if (!lesson || run) {
      return;
    }
    const practice = isDone(catalog, lessonId);
    const started = startQuiz(lesson.questions.length, heartsStore.hearts(), practice);
    setRun(started);
    qaLog('lesson_started', { lessonId, practice, hearts: started.hearts });
    if (started.phase === 'failed') {
      qaLog('lesson_failed', { lessonId });
      setOutOfHearts('open');
    }
  }, [lesson, run, catalog, lessonId]);

  const running = run !== null && (run.phase === 'asking' || run.phase === 'answered');
  usePreventRemove(running && exit === null, () => setQuit('open'));

  useEffect(() => {
    if (exit?.to === 'back') {
      navigation.goBack();
    } else if (exit?.to === 'complete') {
      navigation.replace('LessonComplete', exit.params);
    }
  }, [exit, navigation]);

  const toggleMute = () => {
    haptics.selection();
    sounds.setMuted(!muted);
    setMuted(!muted);
  };

  const finish = (done: QuizState) => {
    const perfect = isPerfect(done);
    const xp = done.practice || !catalog ? 0 : perfect ? catalog.config.xpPerfect : catalog.config.xpFirst;
    if (!done.practice) {
      completionsStore.add({
        lessonId,
        completedAt: new Date().toISOString(),
        attempts: done.attempts,
        perfect,
        synced: false,
      });
    }
    qaLog('lesson_completed', { lessonId, practice: done.practice, perfect, xp });
    setExit({
      to: 'complete',
      params: { lessonId, practice: done.practice, perfect, firstTry: firstTryCount(done), total: done.total },
    });
  };

  const header = (
    <QuizHeader
      run={run}
      muted={muted}
      onClose={() => (running ? setQuit('open') : setExit({ to: 'back' }))}
      onToggleMute={toggleMute}
    />
  );

  let body;
  if (lesson && run) {
    body = (
      <QuizBody
        lesson={lesson}
        run={run}
        locale={locale}
        chip={<LessonChip entry={entry} lesson={lesson} locale={locale} />}
        onRun={setRun}
        onContinue={() => {
          const after = next(run);
          if (after.phase === 'failed') {
            qaLog('lesson_failed', { lessonId });
            setOutOfHearts('open');
          }
          if (after.phase === 'done') {
            finish(after);
          }
          setRun(after);
        }}
      />
    );
  } else if (query.error || query.isPaused) {
    body = (
      <View style={layout.body}>
        <LessonChip entry={entry} lesson={undefined} locale={locale} />
        <View testID="quiz.notCached" style={layout.section}>
          <AppText variant="body">{t('lessons.quiz.notCached')}</AppText>
          <AppButton testID="quiz.retry" label={t('lessons.retry')} variant="white" onPress={() => void query.refetch()} />
        </View>
      </View>
    );
  } else {
    body = (
      <View testID="quiz.skeleton" style={layout.body}>
        <LessonChip entry={entry} lesson={undefined} locale={locale} />
        <Skeleton height={PROMPT_LINE * 2} radius={radii.tile} />
        <Skeleton height={sizes.buttonMinHeight} radius={radii.tile} />
        <Skeleton height={sizes.buttonMinHeight} radius={radii.tile} />
      </View>
    );
  }

  return (
    <Screen testID="quiz.screen">
      {header}
      {body}
      {quit ? (
        <QuitDialog
          closing={quit === 'closing'}
          onQuit={() => {
            haptics.warning();
            setExit({ to: 'back' });
          }}
          onKeep={() => setQuit('closing')}
          onDismiss={() => setQuit(null)}
        />
      ) : null}
      {outOfHearts ? (
        <OutOfHeartsSheet
          msLeft={heartsStore.msUntilReset()}
          closing={outOfHearts === 'closing'}
          onOk={() => setOutOfHearts('closing')}
          onDismiss={() => {
            setOutOfHearts(null);
            setExit({ to: 'back' });
          }}
        />
      ) : null}
    </Screen>
  );
}

type HeaderProps = { run: QuizState | null; muted: boolean; onClose: () => void; onToggleMute: () => void };

/** Close · progress · hearts (or the Practice chip) · speaker. */
function QuizHeader({ run, muted, onClose, onToggleMute }: HeaderProps) {
  const { colors } = useTheme();
  const { hearts } = useHearts();
  const broken = run?.phase === 'answered' && run.lastCorrect === false && !run.practice;
  return (
    <View style={layout.header}>
      <Pressable testID="quiz.close" accessibilityRole="button" accessibilityLabel={t('lessons.quiz.close')} onPress={onClose} style={layout.iconButton}>
        <Svg viewBox="0 0 24 24" width={ICON} height={ICON}>
          <Path d={CLOSE_PATH} stroke={quizColors.close} strokeWidth={CLOSE_STROKE} strokeLinecap="round" />
        </Svg>
      </Pressable>
      <ProgressBar right={run?.right ?? 0} total={run?.total ?? 0} />
      {run?.practice ? (
        <View testID="quiz.practice" style={layout.practice}>
          <AppText variant="chip" tone="teal700">
            {t('lessons.quiz.practice')}
          </AppText>
        </View>
      ) : (
        <View testID="quiz.hearts" style={layout.hearts} accessible accessibilityLabel={t('lessons.hub.heartsA11y', { count: hearts })}>
          <Svg viewBox="0 0 24 24" width={HEART} height={HEART}>
            <Path d={HEART_PATH} fill={heartColor} />
            {broken ? (
              <Path testID="quiz.hearts.broken" d={BROKEN_PATH} stroke={quizColors.brokenHeart} strokeWidth={BROKEN_STROKE} fill="none" />
            ) : null}
          </Svg>
          <AppText variant="h3" tone="ink" style={layout.heartCount}>
            {hearts}
          </AppText>
        </View>
      )}
      <Pressable
        testID="quiz.mute"
        accessibilityRole="switch"
        accessibilityState={{ checked: !muted }}
        accessibilityLabel={muted ? t('lessons.quiz.unmute') : t('lessons.quiz.mute')}
        onPress={onToggleMute}
        style={layout.iconButton}
      >
        <Svg viewBox="0 0 24 24" width={ICON} height={ICON}>
          <Path d={SPEAKER_PATH} fill={colors.muted} />
          <Path d={muted ? MUTED_PATH : WAVES_PATH} stroke={colors.muted} strokeWidth={BROKEN_STROKE} strokeLinecap="round" fill="none" />
        </Svg>
      </Pressable>
    </View>
  );
}

type ChipProps = {
  entry: ReturnType<typeof catalogEntry>;
  lesson: PublicLesson | undefined;
  locale: Locale;
};

/** "<tier title> · <lesson title>" on the lesson glyph's tint. */
function LessonChip({ entry, lesson, locale }: ChipProps) {
  const title = (entry?.lesson.title ?? lesson?.title)?.[locale];
  if (!title) {
    return null;
  }
  const icon = entry?.lesson.icon ?? lesson?.icon;
  const glyph = icon ? glyphColors[icon] : undefined;
  return (
    <View style={[layout.chip, glyph ? { backgroundColor: tierTint(glyph) } : null]}>
      {icon ? <LessonGlyph icon={icon} size={CHIP_GLYPH} color={glyph ?? quizColors.close} /> : null}
      <AppText variant="chip" tone="ink" style={layout.chipText}>
        {entry ? `${entry.tier.title[locale]} · ` : ''}
        <AppText testID="quiz.title" variant="chip" tone="ink" style={layout.chipText}>
          {title}
        </AppText>
      </AppText>
    </View>
  );
}

type BodyProps = {
  lesson: PublicLesson;
  run: QuizState;
  locale: Locale;
  chip: ReactNode;
  onRun: (state: QuizState) => void;
  onContinue: () => void;
};

function optionState(index: number, picked: number | null, run: QuizState, question: PublicQuestion): OptionState {
  if (run.phase === 'answered') {
    if (index === question.correctIndex) {
      return 'correct';
    }
    return index === picked ? 'wrong' : 'idle';
  }
  return index === picked ? 'picked' : 'idle';
}

/** The question on screen, its options, Check and the answer panel. */
function QuizBody({ lesson, run, locale, chip, onRun, onContinue }: BodyProps) {
  const styles = useStyles();
  const companion = useCompanionLevel();
  const [picked, setPicked] = useState<number | null>(null);
  const [imageFailed, setImageFailed] = useState<string | null>(null);
  const questions = useMemo(() => [...lesson.questions].sort((a, b) => a.order - b.order), [lesson]);
  const index = currentIndex(run);
  const question = index === undefined ? undefined : questions[index];
  if (!question) {
    return <View style={layout.body}>{chip}</View>;
  }
  const answered = run.phase === 'answered';

  const check = () => {
    if (picked === null) {
      return;
    }
    const after = answer(run, questions, picked);
    onRun(after);
    if (after.lastCorrect) {
      haptics.success();
      sounds.play('correct');
    } else {
      haptics.error();
      sounds.play('wrong');
      if (!after.practice) {
        heartsStore.loseHeart();
      }
    }
    qaLog('lesson_answer', {
      questionId: question.id,
      correct: after.lastCorrect === true,
      hearts: after.hearts,
      retry: after.retry,
    });
  };

  const image = question.image && imageFailed !== question.image.url ? question.image.url : undefined;
  const explanation = run.lastCorrect
    ? question.explanation[locale]
    : (question.wrongExplanation ?? question.explanation)[locale];

  return (
    <>
      <ScrollView style={layout.fill} contentContainerStyle={layout.scroll}>
        <View style={layout.body}>
          {chip}
          <AppText testID="quiz.prompt" accessibilityRole="header" style={[layout.prompt, styles.prompt]}>
            {question.prompt[locale]}
          </AppText>
          {image ? (
            <Image
              testID="quiz.image"
              source={{ uri: image }}
              resizeMode="contain"
              style={layout.image}
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(image)}
            />
          ) : null}
          <View style={layout.hintRow}>
            <CompanionReaction testID="quiz.companion" level={companion} cheering={answered && run.lastCorrect === true} size={COMPANION} />
            {question.hint ? (
              <View testID="quiz.hint" style={styles.bubble}>
                <AppText variant="body" tone="ink" style={layout.bubbleText}>
                  {question.hint[locale]}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
        <View style={layout.options} accessibilityRole="radiogroup">
          {question.options.map((option, i) => (
            <OptionButton
              key={i}
              index={i}
              text={option[locale]}
              state={optionState(i, picked, run, question)}
              disabled={answered}
              onPress={() => {
                haptics.selection();
                setPicked(i);
              }}
            />
          ))}
        </View>
      </ScrollView>
      {answered ? (
        run.lastCorrect ? (
          <AnswerSheet
            kind="correct"
            explanation={explanation}
            onContinue={() => {
              setPicked(null);
              onContinue();
            }}
          />
        ) : (
          <AnswerSheet
            kind="wrong"
            practice={run.practice}
            correctText={question.options[question.correctIndex]?.[locale] ?? ''}
            explanation={explanation}
            onContinue={() => {
              setPicked(null);
              onContinue();
            }}
          />
        )
      ) : (
        <View style={styles.footer}>
          <AppButton testID="quiz.check" label={t('lessons.quiz.check')} disabled={picked === null} onPress={check} />
        </View>
      )}
    </>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingBottom: spacing[20] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingTop: spacing[16],
  },
  iconButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heartCount: { fontFamily: fontFamily.black, fontSize: HEART_COUNT_SIZE, lineHeight: HEART },
  practice: {
    paddingHorizontal: spacing[10],
    height: sizes.chipHeight,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: quizColors.picked.bg,
  },
  body: { paddingTop: spacing[22], gap: spacing[14] },
  section: { gap: spacing[14] },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[6],
    height: CHIP_HEIGHT,
    paddingHorizontal: spacing[12],
    borderRadius: radii.pill,
  },
  chipText: { fontFamily: fontFamily.black },
  prompt: { fontFamily: fontFamily.black, fontSize: PROMPT_SIZE, lineHeight: PROMPT_LINE },
  image: { width: '100%', height: IMAGE_MAX, borderRadius: radii.tile },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  bubbleText: { fontFamily: fontFamily.extraBold },
  options: { paddingTop: spacing[18], gap: spacing[10] },
});

const useStyles = createThemedStyles(c => ({
  prompt: { color: c.ink },
  bubble: {
    flex: 1,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  footer: {
    paddingTop: spacing[16],
    paddingBottom: spacing[28],
    borderTopWidth: borders.card,
    borderTopColor: c.line,
  },
}));
