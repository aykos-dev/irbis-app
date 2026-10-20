import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../../../shared/components/AppText';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { xoColors, xoSizes } from '../../campTheme';
import type { RosterPlayer, XoMark, XoPublic } from '../../protocol/codec';
import { XoBoard } from './XoBoard';

type Props = {
  info: XoPublic;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** This phone's tap on an empty cell on its turn (host: applied locally; joiner: `xoMove`). */
  onMove: (cell: number) => void;
};

/** Small static mark next to the turn line. */
function MarkIcon({ mark }: { mark: XoMark }) {
  const size = xoSizes.headerMark;
  const common = {
    stroke: xoColors[mark],
    strokeWidth: xoSizes.markStroke,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {mark === 'x' ? (
        <Path d="M20 20L80 80M80 20L20 80" {...common} />
      ) : (
        <Circle cx="50" cy="50" r="32" {...common} />
      )}
    </Svg>
  );
}

const marksOn = (board: XoPublic['board']) =>
  board.filter(cell => cell !== null).length;

/**
 * X and O (campfire-xo AC2, AC3): whose turn, the board, and the result banner once someone wins
 * or the board is full. Every new mark gives a light haptic on both phones.
 */
export function XoScreen({ info, selfSeatId, roster, onMove }: Props) {
  const styles = useStyles();
  const { board, result, turn } = info;
  const selfMark: XoMark | null =
    selfSeatId === info.xSeatId ? 'x' : selfSeatId === info.oSeatId ? 'o' : null;
  const canPlay = selfMark === turn && result === null && !info.paused;
  const nameOf = (seatId: string) =>
    roster.find(player => player.seatId === seatId)?.nickname ?? '';
  const seatOf = (mark: XoMark) => (mark === 'x' ? info.xSeatId : info.oSeatId);

  const placed = marksOn(board);
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

  return (
    <View testID="xo.screen" style={layout.root}>
      <AppText variant="h1" accessibilityRole="header" style={layout.center}>
        {t('camp.games.xo')}
      </AppText>
      {banner ? (
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
      ) : (
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
      )}
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
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
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
