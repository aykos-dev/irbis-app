import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon, SvgXml } from 'react-native-svg';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { bootSvg } from '../../../assets/svg/boot';
import { getMeLevelGetQueryKey, useMeLevelMarkLevelUpSeen } from '../../../shared/api/generated';
import type { MyLevelDto, PendingLevelUpDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { levelUpColors } from '../../../shared/constants/colors';
import { borders, motion, radii, screenPadding, sizes, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { EvolutionSequence } from '../components/EvolutionSequence';
import { levelUpSession } from '../levelUpSession';

const RAYS = 12;
const RAY_OPACITY = 0.08;
/** Sunburst drawn in a 100×100 box, centred behind the companions. */
const SUN_BOX = 100;
const SUN_CENTER_Y = 32;
const SUN_REACH = 120;
const RAY_HALF_ANGLE = Math.PI / RAYS / 2;
/** Four confetti rects, positions as fractions of the screen (canvas LevelUp). */
const confetti = [
  { left: '12%', top: '10%', rotate: '-18deg' },
  { left: '82%', top: '14%', rotate: '24deg' },
  { left: '20%', top: '40%', rotate: '38deg' },
  { left: '76%', top: '44%', rotate: '-30deg' },
] as const;
const CONFETTI_WIDTH = 10;
const CONFETTI_HEIGHT = 16;
const CONFETTI_RADIUS = 2;
const BOOT = 18;
const NUMBER_SQUARE = 22;
const NUMBER_RADIUS = 6;

/** "difficulty 3 and overnight trips" → "Difficulty 3 and overnight trips". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "{Unlock} · {count} new places", or just "{Unlock}" when the level opens no new places. */
export function placesLine(unlock: string, count: number): string {
  const head = capitalize(unlock);
  return count > 0 ? t('levels.up.places', { unlock: head, count }) : head;
}

function rayPoints(index: number): string {
  const angle = (index / RAYS) * Math.PI * 2;
  const cx = SUN_BOX / 2;
  const point = (a: number) =>
    `${cx + Math.cos(a) * SUN_REACH},${SUN_CENTER_Y + Math.sin(a) * SUN_REACH}`;
  return `${cx},${SUN_CENTER_Y} ${point(angle - RAY_HALF_ANGLE)} ${point(angle + RAY_HALF_ANGLE)}`;
}

function Backdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${SUN_BOX} ${SUN_BOX}`} preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: RAYS }, (_, index) => (
          <Polygon key={index} points={rayPoints(index)} fill={levelUpColors.ray} opacity={RAY_OPACITY} />
        ))}
      </Svg>
      {confetti.map((piece, index) => (
        <View
          key={index}
          style={[
            layout.confetti,
            {
              left: piece.left,
              top: piece.top,
              backgroundColor: levelUpColors.confetti[index % levelUpColors.confetti.length],
              transform: [{ rotate: piece.rotate }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function toParams(levelUp: PendingLevelUpDto) {
  return {
    id: levelUp.id,
    fromLevel: levelUp.fromLevel,
    toLevel: levelUp.toLevel,
    maxDifficulty: levelUp.maxDifficulty,
    newPlacesCount: levelUp.newPlacesCount,
  };
}

/**
 * LevelUp (AC7): full-screen celebration of one pending level-up. The evolution sequence plays
 * (or is skipped), then the new level, what it unlocks, Share and Continue. Continue marks it seen
 * and opens the next pending level-up, or closes. Never optimistic: it shows only what the API
 * listed as pending.
 */
export function LevelUpScreen({ navigation, route }: RootStackScreenProps<'LevelUp'>) {
  const { id, fromLevel, toLevel, maxDifficulty, newPlacesCount } = route.params;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [done, setDone] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const { mutateAsync: markSeen } = useMeLevelMarkLevelUpSeen({ mutation: { meta: { silentError: true } } });
  const to = levelMeta(toLevel);
  const name = t(to.nameKey);

  useEffect(() => {
    qaLog('levelup_shown', { from: fromLevel, to: toLevel });
  }, [fromLevel, toLevel]);

  const onDone = useCallback(() => setDone(true), []);
  const onSkip = useCallback((atMs: number) => qaLog('levelup_skipped', { to: toLevel, atMs }), [toLevel]);

  const share = () => {
    qaLog('levelup_share', { to: toLevel });
    Share.share({ message: t('levels.up.shareText', { name }) }).catch(() => {
      qaLog('levelup_share_failed', { to: toLevel });
    });
  };

  const continueOn = async () => {
    if (continuing) {
      return;
    }
    setContinuing(true);
    qaLog('levelup_continue', { to: toLevel });
    levelUpSession.markContinued(id);
    try {
      await markSeen({ id });
    } catch {
      // Still pending on the server: the queue sends `seen` again on the next level refetch.
      qaLog('levelup_seen_failed', { to: toLevel });
    }
    const pending = queryClient.getQueryData<MyLevelDto>(getMeLevelGetQueryKey())?.pendingLevelUps ?? [];
    const next = levelUpSession.next(pending.filter(item => item.id !== id));
    if (next) {
      levelUpSession.markShown(next.id);
      navigation.replace('LevelUp', toParams(next));
    } else {
      navigation.goBack();
    }
    void queryClient.invalidateQueries({ queryKey: getMeLevelGetQueryKey() });
  };

  return (
    <View
      testID="levelup.screen"
      style={[
        layout.root,
        {
          paddingTop: insets.top + spacing[24],
          paddingBottom: insets.bottom || spacing[20],
          paddingStart: screenPadding + insets.left,
          paddingEnd: screenPadding + insets.right,
        },
      ]}
    >
      <Backdrop />
      <EvolutionSequence
        fromLevel={fromLevel}
        toLevel={toLevel}
        reducedMotion={reducedMotion}
        onDone={onDone}
        onSkip={onSkip}
      />
      {done ? (
        <View style={layout.end}>
          <View style={layout.headings}>
            <AppText variant="h2" accessibilityRole="header" style={layout.eyebrow}>
              {t('levels.up.eyebrow')}
            </AppText>
            <AppText testID="levelup.title" variant="h1" tone="white" style={layout.center}>
              {t('levels.up.title', { name })}
            </AppText>
            <View testID="levelup.pill" style={layout.pill}>
              <View style={[layout.number, { backgroundColor: to.color }]}>
                <AppText variant="chip" tone="white">
                  {String(to.level)}
                </AppText>
              </View>
              <AppText variant="chip" tone="white">
                {`${t(to.animalKey)} · ${t(to.traitKey)}`}
              </AppText>
            </View>
          </View>
          <View testID="levelup.unlocked" style={layout.card}>
            <AppText variant="caption" tone="white">
              {t('levels.up.unlocked')}
            </AppText>
            <View
              style={layout.boots}
              accessible
              accessibilityLabel={t('places.difficulty', { d: maxDifficulty })}
            >
              {Array.from({ length: maxDifficulty }, (_, index) => (
                <SvgXml key={index} xml={bootSvg} width={BOOT} height={BOOT} color={levelUpColors.boots} />
              ))}
            </View>
            <AppText testID="levelup.places" variant="body" tone="white">
              {placesLine(t(to.unlockKey), newPlacesCount)}
            </AppText>
          </View>
          <View style={layout.actions}>
            <AppButton testID="levelup.share" variant="white" label={t('levels.up.share')} onPress={share} />
            <ContinueButton
              label={t('levels.up.continue')}
              busy={continuing}
              onPress={() => {
                haptics.tap();
                void continueOn();
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Gold Continue (canvas LevelUp `#FFC800`, 4 px bottom edge). */
function ContinueButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID="levelup.continue"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={layout.continue}
    >
      <AppText variant="button" style={layout.continueLabel}>
        {label}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  root: { flex: 1, backgroundColor: levelUpColors.bg, gap: spacing[16] },
  confetti: {
    position: 'absolute',
    width: CONFETTI_WIDTH,
    height: CONFETTI_HEIGHT,
    borderRadius: CONFETTI_RADIUS,
  },
  end: { flex: 1, justifyContent: 'space-between', gap: spacing[16] },
  headings: { alignItems: 'center', gap: spacing[8] },
  eyebrow: { color: levelUpColors.headline, textAlign: 'center' },
  center: { textAlign: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingStart: spacing[4],
    paddingEnd: spacing[12],
    paddingVertical: spacing[4],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: levelUpColors.card,
  },
  number: {
    width: NUMBER_SQUARE,
    height: NUMBER_SQUARE,
    borderRadius: NUMBER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: spacing[8],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: levelUpColors.card,
  },
  boots: { flexDirection: 'row', gap: spacing[4] },
  actions: { gap: spacing[12] },
  continue: {
    minHeight: sizes.buttonMinHeight,
    paddingVertical: sizes.buttonPaddingVertical,
    paddingHorizontal: sizes.buttonPaddingHorizontal,
    borderRadius: radii.button,
    borderBottomWidth: motion.pressDepth,
    borderBottomColor: levelUpColors.continueEdge,
    backgroundColor: levelUpColors.continue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueLabel: { color: levelUpColors.onContinue, textAlign: 'center' },
});
