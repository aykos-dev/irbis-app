import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { bootSvg } from '../../../assets/svg/boot';
import type { RootStackScreenProps } from '../../../app/navigation/types';
import type { LevelDefDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { LevelFrame } from '../../../shared/components/levels/LevelFrame';
import { levelMeta, MIN_LEVEL } from '../../../shared/components/levels/levelMeta';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { difficultyBootColor } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { qaLog } from '../../../shared/utils/qaLog';
import { LevelHeader } from '../components/LevelHeader';
import { formatRequirement } from '../formatRequirement';
import { useLevelDefs } from '../hooks/useLevelDefs';
import { useMyLevel } from '../hooks/useMyLevel';

const FRAME = 120;
const BOOTS_MAX = 5;
const BOOT = 16;
const BOOT_OFF_OPACITY = 0.18;
const SKELETON_CARD = 180;
const SKELETON_CARDS = 3;

/** Companions (AC6): all seven levels, yours marked "You", the ones above it as silhouettes. */
export function CompanionsScreen({ navigation }: RootStackScreenProps<'Companions'>) {
  const locale = useLocale();
  const { status } = useAuth();
  const { isOnline } = useNetworkStatus();
  const defs = useLevelDefs();
  const mine = useMyLevel();
  const myLevel = status === 'guest' ? MIN_LEVEL : mine.data?.level;
  const items = defs.data?.items;

  const logged = useRef(false);
  useEffect(() => {
    if (myLevel !== undefined && items && !logged.current) {
      logged.current = true;
      qaLog('companions_viewed', { level: myLevel });
    }
  }, [myLevel, items]);

  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Profile' } }] });
  const error = defs.error ?? (status === 'signedIn' ? mine.error : null);
  const retry = () => {
    void defs.refetch();
    if (status === 'signedIn') {
      void mine.refetch();
    }
  };

  let body;
  if (items && myLevel !== undefined) {
    body = [...items]
      .sort((a, b) => a.level - b.level)
      .map(def => <CompanionCard key={def.level} def={def} myLevel={myLevel} locale={locale} />);
  } else if (error) {
    body = (
      <ErrorState
        testID="companions.error"
        retryTestID="companions.retry"
        title={t('levels.error')}
        error={error}
        onRetry={retry}
      />
    );
  } else if (!isOnline && status !== 'loading') {
    body = (
      <View testID="companions.offline" style={layout.section}>
        <AppText variant="body">{t('levels.offline')}</AppText>
        <AppButton testID="companions.retry" label={t('common.retry')} variant="white" onPress={retry} />
      </View>
    );
  } else {
    body = (
      <View testID="companions.skeleton" style={layout.section}>
        {Array.from({ length: SKELETON_CARDS }, (_, index) => (
          <Skeleton key={index} height={SKELETON_CARD} radius={radii.card} />
        ))}
      </View>
    );
  }

  return (
    <Screen testID="companions.screen" scroll>
      <LevelHeader title={t('levels.companions.title')} onBack={goBack} backTestID="companions.back" />
      <AppText variant="caption">{t('levels.companions.eyebrow')}</AppText>
      {body}
    </Screen>
  );
}

function Boots({ count }: { count: number }) {
  return (
    <View style={layout.boots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: BOOTS_MAX }, (_, index) => (
        <SvgXml
          key={index}
          xml={bootSvg}
          width={BOOT}
          height={BOOT}
          color={difficultyBootColor}
          opacity={index < count ? 1 : BOOT_OFF_OPACITY}
        />
      ))}
    </View>
  );
}

type CardProps = { def: LevelDefDto; myLevel: number; locale: Locale };

function CompanionCard({ def, myLevel, locale }: CardProps) {
  const styles = useStyles();
  const meta = levelMeta(def.level);
  const current = meta.level === myLevel;
  const locked = meta.level > myLevel;
  const animal = t(meta.animalKey);

  return (
    <View
      testID={`companions.card.${meta.level}`}
      style={[styles.card, current ? { borderColor: meta.color } : null]}
    >
      <LevelFrame level={meta.level} size={FRAME}>
        {art => (
          <CompanionArt
            testID={`companions.art.${meta.level}`}
            level={meta.level}
            size={art}
            silhouette={locked}
            accessibilityLabel={animal}
          />
        )}
      </LevelFrame>
      <View style={layout.text}>
        <View style={layout.chips}>
          <View style={[layout.pill, { backgroundColor: meta.color }]}>
            <AppText variant="chip" tone="white">
              {t('levels.pill', { n: meta.level })}
            </AppText>
          </View>
          {current ? (
            <View testID="companions.you" style={[layout.pill, { backgroundColor: meta.tint }]}>
              <AppText variant="chip" style={{ color: meta.text }}>
                {t('levels.companions.you')}
              </AppText>
            </View>
          ) : null}
        </View>
        <Boots count={def.maxDifficulty} />
        <AppText variant="h3">{t(meta.nameKey)}</AppText>
        <AppText variant="small" tone="muted">
          {`${animal} · ${t(meta.traitKey)}`}
        </AppText>
        <AppText variant="small">{formatRequirement(def, locale)}</AppText>
        <AppText variant="small" tone="muted">
          {t('levels.companions.unlocks', { unlock: t(meta.unlockKey) })}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
  text: { flex: 1, gap: spacing[6] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[6] },
  pill: { paddingHorizontal: spacing[10], paddingVertical: spacing[4], borderRadius: radii.pill },
  boots: { flexDirection: 'row', gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    gap: spacing[14],
    padding: spacing[14],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
