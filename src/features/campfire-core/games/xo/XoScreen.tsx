import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { MuteButton } from '../../../../shared/sounds/MuteButton';
import { sounds, type Clip } from '../../../../shared/sounds/sounds';
import { haptics } from '../../../../shared/utils/haptics';
import type { RosterPlayer, XoMark, XoPublic } from '../../protocol/codec';
import { MarkIcon } from './MarkIcon';
import { XoBoard } from './XoBoard';
import { XoFinal } from './XoFinal';
import { XoScoreBar } from './XoScoreBar';

type Props = {
  info: XoPublic;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** This phone's tap on an empty cell on its turn (host: applied locally; joiner: `xoMove`). */
  onMove: (cell: number) => void;
  /** "Next game" after a result (host: applied locally; joiner: `xoNext`). */
  onNext: () => void;
  /** Host only: End (asks first), and the final score's buttons. */
  host?: { onEnd: () => void; onPlayAgain: () => void; onLobby: () => void };
};

/** This phone's clip for a result (AC8): win / lose for the players, a draw sounds the same on both. */
function resultClip(result: XoPublic['result'], selfMark: XoMark | null): Clip | null {
  if (!result) {
    return null;
  }
  if (result.kind === 'draw') {
    return 'correct';
  }
  return result.mark === selfMark ? 'complete' : 'wrong';
}

const marksOn = (board: XoPublic['board']) =>
  board.filter(cell => cell !== null).length;

/**
 * X and O (campfire-xo AC2–AC8): header (mute, game number, host End), the series score, whose
 * turn, the board, the result banner with "Next game", a pause while the other phone reconnects,
 * and the final score once the host ends the series. Every new mark gives a light haptic.
 */
export function XoScreen({ info, selfSeatId, roster, onMove, onNext, host }: Props) {
  const styles = useStyles();
  const { board, result, turn } = info;
  const selfMark: XoMark | null =
    selfSeatId === info.xSeatId ? 'x' : selfSeatId === info.oSeatId ? 'o' : null;
  const canPlay = selfMark === turn && result === null && !info.paused;
  const nameOf = (seatId: string) =>
    roster.find(player => player.seatId === seatId)?.nickname ?? '';
  const seatOf = (mark: XoMark) => (mark === 'x' ? info.xSeatId : info.oSeatId);

  const placed = marksOn(board);
  const clip = resultClip(result, selfMark);
  const resultKey = result ? `${info.gameNo}.${result.kind}` : null;
  const heard = useRef(resultKey);

  useEffect(() => {
    void sounds.load();
  }, []);

  // A result that arrives while this screen is open plays once; one already there on mount stays quiet.
  useEffect(() => {
    if (resultKey && resultKey !== heard.current && clip) {
      sounds.play(clip, 'xo_');
    }
    heard.current = resultKey;
  }, [resultKey, clip]);

  const seen = useRef(placed);
  useEffect(() => {
    if (placed > seen.current) {
      haptics.tap();
    }
    seen.current = placed;
  }, [placed]);

  const resultText = () => {
    if (!result) {
      return null;
    }
    if (result.kind === 'draw') {
      return t('camp.xo.draw');
    }
    return result.mark === selfMark
      ? t('camp.xo.youWin')
      : t('camp.xo.theyWin', { name: nameOf(seatOf(result.mark)) });
  };
  const banner = resultText();

  if (info.ended) {
    return (
      <XoFinal
        ended={info.ended}
        info={info}
        selfSeatId={selfSeatId}
        roster={roster}
        host={host ? { onPlayAgain: host.onPlayAgain, onLobby: host.onLobby } : undefined}
      />
    );
  }

  const waitingFor = info.paused
    ? nameOf(selfSeatId === info.xSeatId ? info.oSeatId : info.xSeatId)
    : null;

  return (
    <View testID="xo.screen" style={layout.root}>
      <View style={layout.header}>
        <MuteButton
          testID="xo.mute"
          muteLabel={t('camp.xo.mute')}
          unmuteLabel={t('camp.xo.unmute')}
        />
        <View style={layout.title}>
          <AppText variant="h1" accessibilityRole="header" style={layout.center}>
            {t('camp.games.xo')}
          </AppText>
          <AppText testID="xo.game" variant="small" tone="muted">
            {t('camp.xo.game', { n: info.gameNo })}
          </AppText>
        </View>
        {host ? (
          <AppButton
            testID="xo.end"
            label={t('camp.xo.end')}
            variant="white"
            onPress={() => {
              haptics.tap();
              host.onEnd();
            }}
          />
        ) : (
          <View style={layout.headerSpacer} />
        )}
      </View>
      <XoScoreBar info={info} roster={roster} />
      {waitingFor !== null ? (
        <View
          testID="xo.paused"
          style={[layout.banner, styles.banner]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <AppText variant="h3" style={layout.center}>
            {t('camp.xo.waiting', { name: waitingFor })}
          </AppText>
        </View>
      ) : null}
      {waitingFor === null && banner ? (
        <View
          testID="xo.result"
          style={[layout.banner, styles.banner]}
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <AppText variant="h2" style={layout.center}>
            {banner}
          </AppText>
        </View>
      ) : null}
      {waitingFor === null && !banner ? (
        <View
          testID="xo.turn"
          style={layout.turn}
          accessible
          accessibilityLiveRegion="polite"
        >
          <AppText variant="h3">
            {turn === selfMark
              ? t('camp.xo.yourTurn')
              : t('camp.xo.theirTurn', { name: nameOf(seatOf(turn)) })}
          </AppText>
          <MarkIcon mark={turn} />
        </View>
      ) : null}
      <XoBoard
        board={board}
        line={result?.kind === 'win' ? result.line : null}
        canPlay={canPlay}
        onPress={cell => {
          if (canPlay && board[cell] === null) {
            onMove(cell);
          }
        }}
      />
      {result && !info.paused ? (
        <AppButton
          testID="xo.next"
          label={t('camp.xo.next')}
          onPress={() => {
            haptics.tap();
            onNext();
          }}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  title: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: sizes.touchTarget },
  center: { textAlign: 'center' },
  turn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
  },
  banner: {
    padding: spacing[14],
    borderRadius: radii.card,
  },
});

const useStyles = createThemedStyles(c => ({
  banner: { backgroundColor: c.card },
}));
