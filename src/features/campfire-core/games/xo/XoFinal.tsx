import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type { RosterPlayer, XoPublic } from '../../protocol/codec';
import { Confetti } from '../mafia/GameOver';
import { seriesSeats } from './XoScoreBar';

type Ended = NonNullable<XoPublic['ended']>;

type Props = {
  ended: Ended;
  info: XoPublic;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** The host's buttons; the other player waits for the host instead. */
  host?: { onPlayAgain: () => void; onLobby: () => void };
};

/** The viewer's line: "You win", "<name> wins" or a tie; the viewer's wins come first. */
function seriesLine(
  ended: Ended,
  selfSeatId: string | null,
  seats: string[],
  roster: RosterPlayer[],
): { text: string; tie: boolean } {
  const self = selfSeatId && seats.includes(selfSeatId) ? selfSeatId : seats[0];
  const other = seats.find(seatId => seatId !== self);
  const a = self ? (ended.score[self] ?? 0) : 0;
  const b = other ? (ended.score[other] ?? 0) : 0;
  if (a === b) {
    return { text: t('camp.xo.tie', { a, b: a }), tie: true };
  }
  if (a > b) {
    return { text: t('camp.xo.youWinSeries', { a, b }), tie: false };
  }
  const name = roster.find(player => player.seatId === other)?.nickname ?? '';
  return { text: t('camp.xo.theyWinSeries', { name, a: b, b: a }), tie: false };
}

/** Final score on both phones (AC7): who won the series, draws and games; confetti unless a tie. */
export function XoFinal({ ended, info, selfSeatId, roster, host }: Props) {
  const { text, tie } = seriesLine(
    ended,
    selfSeatId,
    seriesSeats(info, roster),
    roster,
  );

  useEffect(() => {
    haptics.heavy();
  }, []);

  return (
    <View testID="xo.final" style={layout.root}>
      {tie ? null : <Confetti />}
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.xo.final')}
        </AppText>
        <AppText
          testID="xo.final.line"
          variant="h2"
          style={layout.center}
          accessibilityLiveRegion="polite"
        >
          {text}
        </AppText>
        <AppText testID="xo.final.stats" variant="body" tone="muted">
          {t('camp.xo.finalStats', { d: ended.draws, n: ended.games })}
        </AppText>
      </View>
      {host ? (
        <View style={layout.buttons}>
          <AppButton
            testID="xo.play-again"
            label={t('camp.maf.playAgain')}
            onPress={() => {
              haptics.tap();
              host.onPlayAgain();
            }}
          />
          <AppButton
            testID="xo.lobby"
            label={t('camp.maf.lobby')}
            variant="white"
            onPress={() => {
              haptics.tap();
              host.onLobby();
            }}
          />
        </View>
      ) : (
        <AppText testID="xo.wait-host" variant="body" tone="muted" style={layout.center}>
          {t('camp.maf.waitHost')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[8], alignItems: 'center' },
  buttons: { gap: spacing[12] },
  center: { textAlign: 'center' },
});
