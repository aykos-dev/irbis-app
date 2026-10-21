import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { mafiaConfetti, mafiaSizes } from '../../campTheme';
import type {
  MafiaOut,
  MafiaPhase,
  MafiaWinner,
  RosterPlayer,
} from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { fateLabel, phaseLabel, RoleChip } from './OutList';
import type { RoleId } from './roles';

type Props = {
  phase: MafiaPhase;
  winner: MafiaWinner;
  /** Every dealt seat's role, in seat order. */
  roles: Record<string, RoleId>;
  out: MafiaOut[];
  roster: RosterPlayer[];
  /** The host's buttons; players wait for the host instead. */
  host?: { onLobby: () => void; onPlayAgain: () => void };
};

/** Game over on every phone (AC6, canvas MafEnd): the winner, survivors and everyone's role. */
export function GameOver({ phase, winner, roles, out, roster, host }: Props) {
  const styles = useStyles();
  const seats = Object.keys(roles);
  const survived = seats.filter(
    seatId => !out.some(entry => entry.seatId === seatId),
  ).length;

  useEffect(() => {
    haptics.heavy();
  }, []);

  return (
    <View testID="maf.over" style={layout.root}>
      {winner === 'none' ? null : <Confetti />}
      <View style={layout.header}>
        <AppText variant="small" tone="muted">
          {t('camp.maf.overLine', { phase: phaseLabel(phase) })}
        </AppText>
        <AppText variant="h1" accessibilityRole="header">
          {t(`camp.maf.win.${winner}`)}
        </AppText>
        <AppText variant="body">
          {t('camp.maf.survived', { s: survived })}
        </AppText>
      </View>

      <View style={layout.list}>
        <AppText variant="h3" accessibilityRole="header">
          {t('camp.maf.everyone')}
        </AppText>
        {seats.map(seatId => {
          const player = roster.find(seat => seat.seatId === seatId);
          const fate = out.find(entry => entry.seatId === seatId);
          const roleId = roles[seatId];
          return (
            <View
              key={seatId}
              testID={`maf.over.${seatId}`}
              style={[layout.row, styles.row, fate ? layout.out : null]}
            >
              {player ? (
                <SeatAvatar avatar={player.avatar} size={mafiaSizes.rowAvatar} />
              ) : null}
              <View style={layout.fill}>
                <AppText variant="body">{player?.nickname ?? ''}</AppText>
                <AppText variant="small" tone={fate ? 'red700' : 'muted'}>
                  {fate ? fateLabel(fate) : t('camp.maf.alive')}
                </AppText>
              </View>
              {roleId ? <RoleChip roleId={roleId} /> : null}
            </View>
          );
        })}
      </View>

      {host ? (
        <View style={layout.buttons}>
          <AppButton
            testID="maf.play-again"
            label={t('camp.maf.playAgain')}
            onPress={() => {
              haptics.tap();
              host.onPlayAgain();
            }}
          />
          <AppButton
            testID="maf.lobby"
            label={t('camp.maf.lobby')}
            variant="white"
            onPress={() => {
              haptics.tap();
              host.onLobby();
            }}
          />
        </View>
      ) : (
        <AppText testID="maf.wait-host" variant="body" tone="muted" style={layout.center}>
          {t('camp.maf.waitHost')}
        </AppText>
      )}
    </View>
  );
}

/** A few coloured rects falling and fading once (≤ 1.5 s); decorative (also X and O final score and the Crocodile summary). */
export function Confetti() {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: mafiaSizes.confettiMs });
  }, [progress]);
  const fall = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: progress.value * mafiaSizes.confettiFall }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, fall]}
    >
      {mafiaConfetti.map(piece => (
        <View
          key={piece.left}
          style={[
            layout.confetti,
            {
              left: piece.left,
              backgroundColor: piece.color,
              transform: [{ rotate: piece.rotate }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6], alignItems: 'center' },
  list: { gap: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  out: { opacity: mafiaSizes.outOpacity },
  fill: { flex: 1 },
  buttons: { gap: spacing[12] },
  center: { textAlign: 'center' },
  confetti: {
    position: 'absolute',
    top: 0,
    width: mafiaSizes.confettiWidth,
    height: mafiaSizes.confettiHeight,
    borderRadius: mafiaSizes.confettiRadius,
  },
});

const useStyles = createThemedStyles(c => ({
  row: { borderColor: c.line, backgroundColor: c.card },
}));
