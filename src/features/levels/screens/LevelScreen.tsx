import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import type { LevelDefDto, NextLevelDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { LevelFrame } from '../../../shared/components/levels/LevelFrame';
import { levelMeta, MIN_LEVEL } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { levelRequirementColors, palette } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { LevelHeader } from '../components/LevelHeader';
import { RequirementRow } from '../components/RequirementRow';
import { lessonsLabel } from '../formatRequirement';
import { useLevelDefs } from '../hooks/useLevelDefs';
import { useMyLevel } from '../hooks/useMyLevel';

const FRAME = 210;
const NEXT_ART = 72;
const SKELETON_TITLE = 32;
const SKELETON_CARD = 220;

/** What the screen shows: a signed-in user's level, or a guest at level 1. */
type LevelView = { level: number; reachedAt: string | null; next: NextLevelDto | null };

/** A guest sits at level 1 with empty bars towards level 2 (AC5). */
export function guestView(defs: LevelDefDto[]): LevelView | undefined {
  const target = defs.find(def => def.level === MIN_LEVEL + 1);
  if (!target) {
    return undefined;
  }
  return {
    level: MIN_LEVEL,
    reachedAt: null,
    next: {
      level: target.level,
      xp: { current: 0, required: target.xp },
      lessons: { current: 0, required: target.lessons.required, kind: target.lessons.kind, tier: target.lessons.tier },
      checkIns: { current: 0, required: target.checkIns.required, minDifficulty: target.checkIns.minDifficulty },
      verifiedSpots: target.verifiedSpots > 0 ? { current: 0, required: target.verifiedSpots } : null,
    },
  };
}

/** Level screen (AC5): the companion frame, bars to the next level and the next companion. */
export function LevelScreen({ navigation }: RootStackScreenProps<'Level'>) {
  const locale = useLocale();
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const guest = status === 'guest';
  const mine = useMyLevel();
  const defs = useLevelDefs({ enabled: guest });
  const query = guest ? defs : mine;

  let view: LevelView | undefined;
  if (guest) {
    view = defs.data ? guestView(defs.data.items) : undefined;
  } else if (mine.data) {
    view = { level: mine.data.level, reachedAt: mine.data.reachedAt, next: mine.data.next };
  }

  const logged = useRef(false);
  useEffect(() => {
    if (view && !logged.current) {
      logged.current = true;
      qaLog('level_viewed', { level: view.level, guest });
    }
  }, [view, guest]);

  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Profile' } }] });
  const retry = () => void query.refetch();

  let body;
  if (view) {
    body = (
      <LevelBody
        view={view}
        guest={guest}
        locale={locale}
        onCompanions={() => {
          haptics.tap();
          navigation.navigate('Companions');
        }}
        onContinue={() => {
          haptics.tap();
          navigation.navigate('MainTabs', { screen: 'Lessons' });
        }}
        onSignUp={() => navigation.navigate('Auth', { screen: 'SignUp' })}
        onLogIn={() => navigation.navigate('Auth', { screen: 'LogIn' })}
      />
    );
  } else if (query.error) {
    body = (
      <ErrorState
        testID="level.error"
        retryTestID="level.retry"
        title={t('levels.error')}
        error={query.error}
        onRetry={retry}
      />
    );
  } else if (!isOnline && status !== 'loading') {
    body = (
      <View testID="level.offline" style={layout.section}>
        <AppText variant="body">{t('levels.offline')}</AppText>
        <AppButton testID="level.retry" label={t('common.retry')} variant="white" onPress={retry} />
      </View>
    );
  } else {
    body = (
      <View testID="level.skeleton" style={layout.center}>
        <Skeleton height={FRAME} width={FRAME} radius={radii.pill} />
        <Skeleton height={SKELETON_TITLE} width="60%" />
        <Skeleton height={SKELETON_CARD} radius={radii.card} />
      </View>
    );
  }

  return (
    <Screen testID="level.screen" scroll>
      <LevelHeader title={t('levels.title')} onBack={goBack} backTestID="level.back" />
      {body}
    </Screen>
  );
}

type BodyProps = {
  view: LevelView;
  guest: boolean;
  locale: Locale;
  onCompanions: () => void;
  onContinue: () => void;
  onSignUp: () => void;
  onLogIn: () => void;
};

function sinceLine(level: number, reachedAt: string): string {
  const date = new Date(reachedAt);
  return t('levels.since', {
    animal: t(levelMeta(level).animalKey),
    month: t(`levels.months.${date.getMonth() + 1}`),
    year: date.getFullYear(),
  });
}

function LevelBody({ view, guest, locale, onCompanions, onContinue, onSignUp, onLogIn }: BodyProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = levelMeta(view.level);
  const { next } = view;

  return (
    <>
      <View style={layout.center}>
        <LevelFrame testID="level.frame" level={meta.level} size={FRAME}>
          {art => (
            <CompanionArt level={meta.level} size={art} accessibilityLabel={t(meta.animalKey)} />
          )}
        </LevelFrame>
        <View testID="level.pill" style={[layout.pill, { backgroundColor: meta.color }]}>
          <AppText variant="chip" tone="white">
            {t('levels.pill', { n: meta.level })}
          </AppText>
        </View>
        <AppText testID="level.name" variant="h1" accessibilityRole="header" style={layout.centered}>
          {t(meta.nameKey)}
        </AppText>
        {view.reachedAt ? (
          <AppText testID="level.since" variant="body" tone="muted" style={layout.centered}>
            {sinceLine(meta.level, view.reachedAt)}
          </AppText>
        ) : null}
      </View>
      {next ? <NextLevelCard next={next} locale={locale} /> : (
        <View testID="level.max" style={[styles.card, layout.maxCard]}>
          <Icon name="star" color={palette.gold} />
          <AppText variant="h3" style={layout.flex}>
            {t('levels.max')}
          </AppText>
        </View>
      )}
      {next ? <NextCompanionCard level={next.level} /> : null}
      <Pressable
        testID="level.companions-link"
        accessibilityRole="link"
        accessibilityLabel={t('levels.seeAll')}
        onPress={onCompanions}
        style={layout.link}
      >
        <AppText variant="h3" tone="teal700">
          {t('levels.seeAll')}
        </AppText>
        <Icon name="chevron" color={colors.teal700} size={spacing[18]} />
      </Pressable>
      {guest ? (
        <View testID="level.guest-cta" style={[styles.card, layout.section]}>
          <AppText variant="h3">{t('levels.guest.title')}</AppText>
          <AppButton testID="level.guest-signup" label={t('auth.profile.createAccount')} onPress={onSignUp} />
          <AppButton testID="level.guest-login" label={t('auth.profile.logIn')} variant="white" onPress={onLogIn} />
        </View>
      ) : (
        <AppButton testID="level.continue" label={t('levels.continue')} onPress={onContinue} />
      )}
    </>
  );
}

function NextLevelCard({ next, locale }: { next: NextLevelDto; locale: Locale }) {
  const styles = useStyles();
  const c = levelRequirementColors;
  return (
    <View testID="level.next" style={[styles.card, layout.section]}>
      <AppText variant="h3" accessibilityRole="header">
        {t('levels.toReach', { n: next.level, name: t(levelMeta(next.level).nameKey) })}
      </AppText>
      <RequirementRow
        testID="level.req-xp"
        icon="bolt"
        tileColor={c.xpTile}
        barColor={c.xpBar}
        label={t('levels.req.xp')}
        current={next.xp.current}
        required={next.xp.required}
        locale={locale}
      />
      <RequirementRow
        testID="level.req-lessons"
        icon="cross"
        tileColor={c.lessonsTile}
        barColor={c.lessonsBar}
        label={lessonsLabel(next.lessons)}
        current={next.lessons.current}
        required={next.lessons.required}
        locale={locale}
      />
      <RequirementRow
        testID="level.req-checkins"
        icon="explore"
        tileColor={c.checkInsTile}
        barColor={c.checkInsBar}
        label={t('levels.req.checkIns', { d: next.checkIns.minDifficulty })}
        current={next.checkIns.current}
        required={next.checkIns.required}
        locale={locale}
        note={t('levels.req.checkInsNote')}
      />
      {next.verifiedSpots ? (
        <RequirementRow
          testID="level.req-spots"
          icon="check"
          tileColor={c.spotsTile}
          barColor={c.spotsBar}
          label={t('levels.req.spots')}
          current={next.verifiedSpots.current}
          required={next.verifiedSpots.required}
          locale={locale}
        />
      ) : null}
    </View>
  );
}

function NextCompanionCard({ level }: { level: number }) {
  const styles = useStyles();
  const meta = levelMeta(level);
  return (
    <View testID="level.next-companion" style={[styles.card, layout.nextCompanion]}>
      <CompanionArt testID="level.next-art" level={meta.level} size={NEXT_ART} silhouette />
      <View style={layout.flex}>
        <AppText variant="caption">{t('levels.next.cap')}</AppText>
        <AppText variant="h3">{t('levels.next.name', { name: t(meta.nameKey) })}</AppText>
        <AppText variant="small" tone="muted">
          {t('levels.next.unlocks', { unlock: t(meta.unlockKey) })}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing[12] },
  centered: { textAlign: 'center' },
  section: { gap: spacing[14] },
  flex: { flex: 1 },
  pill: { paddingHorizontal: spacing[12], paddingVertical: spacing[4], borderRadius: radii.pill },
  maxCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  nextCompanion: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[6], minHeight: spacing[44] },
});

const useStyles = createThemedStyles(c => ({
  card: {
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
