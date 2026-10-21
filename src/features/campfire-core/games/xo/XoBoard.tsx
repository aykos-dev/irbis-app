import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';

import { Pressable } from '../../../../shared/components/Pressable';
import { sizes } from '../../../../shared/constants/spacing';
import { useTheme } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { xoColors, xoSizes } from '../../campTheme';
import type { XoMark } from '../../protocol/codec';
import type { XoBoard as Board, XoLine } from './xoRules';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BOX = xoSizes.boardBox;
const CELL = xoSizes.cellBox;
/** X: two diagonals; O: a circle drawn from the top. Lengths in cell units for the stroke dash. */
const MARK_PATHS: Record<XoMark, { d: string; length: number }> = {
  x: { d: 'M28 28L72 72M72 28L28 72', length: 2 * Math.hypot(44, 44) },
  o: { d: 'M50 24a26 26 0 1 1 0 52a26 26 0 1 1 0-52', length: 2 * Math.PI * 26 },
};

/** Strokes a path in over `markMs` (stroke dash), at once with reduced motion. */
function useDraw(length: number) {
  const reducedMotion = useReducedMotion();
  const offset = useSharedValue(reducedMotion ? 0 : length);
  useEffect(() => {
    offset.value = withTiming(0, {
      duration: reducedMotion ? 0 : xoSizes.markMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [offset, reducedMotion]);
  return useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
}

function Mark({ mark }: { mark: XoMark }) {
  const { d, length } = MARK_PATHS[mark];
  const animatedProps = useDraw(length);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${CELL} ${CELL}`}>
      <AnimatedPath
        d={d}
        stroke={xoColors[mark]}
        strokeWidth={xoSizes.markStroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

const centre = (cell: number) => ({
  x: (cell % 3) * CELL + CELL / 2,
  y: Math.floor(cell / 3) * CELL + CELL / 2,
});

/** The winning line across its 3 cells, overshooting the outer centres a little. */
function WinLine({ line }: { line: XoLine }) {
  const from = centre(line[0]);
  const to = centre(line[2]);
  const reach = CELL * 0.3;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);
  const ux = dx / span;
  const uy = dy / span;
  const d = `M${from.x - ux * reach} ${from.y - uy * reach}L${to.x + ux * reach} ${to.y + uy * reach}`;
  const length = span + 2 * reach;
  const animatedProps = useDraw(length);
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${BOX} ${BOX}`}
      pointerEvents="none"
    >
      <AnimatedPath
        d={d}
        stroke={xoColors.line}
        strokeWidth={xoSizes.lineStroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={length}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

type Props = {
  board: Board;
  /** Winning cells once the game is won. */
  line: XoLine | null;
  /** Cells take taps only on this phone's turn while the game runs. */
  canPlay: boolean;
  onPress: (cell: number) => void;
};

/** 3 × 3 grid (AC2, AC3): tappable cells ≥ 44 pt, marks stroked in, the winning line over the top. */
export function XoBoard({ board, line, canPlay, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <View testID="xo.board" style={layout.board}>
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${BOX} ${BOX}`}
        pointerEvents="none"
      >
        {[CELL, CELL * 2].map(at => (
          <Line
            key={`v${at}`}
            x1={at}
            y1={xoSizes.gridStroke}
            x2={at}
            y2={BOX - xoSizes.gridStroke}
            stroke={colors.line}
            strokeWidth={xoSizes.gridStroke}
            strokeLinecap="round"
          />
        ))}
        {[CELL, CELL * 2].map(at => (
          <Line
            key={`h${at}`}
            x1={xoSizes.gridStroke}
            y1={at}
            x2={BOX - xoSizes.gridStroke}
            y2={at}
            stroke={colors.line}
            strokeWidth={xoSizes.gridStroke}
            strokeLinecap="round"
          />
        ))}
      </Svg>
      {board.map((mark, cell) => {
        const disabled = !canPlay || mark !== null;
        return (
          <Pressable
            key={cell}
            testID={`xo.cell.${cell}`}
            accessibilityLabel={t('camp.xo.cell', {
              n: cell + 1,
              state: mark ? mark.toUpperCase() : t('camp.xo.empty'),
            })}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onPress(cell)}
            style={layout.cell}
          >
            {mark ? <Mark mark={mark} /> : null}
          </Pressable>
        );
      })}
      {line ? <WinLine line={line} /> : null}
    </View>
  );
}

const layout = StyleSheet.create({
  board: {
    width: '100%',
    maxWidth: xoSizes.board,
    aspectRatio: 1,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33.333%',
    height: '33.333%',
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
  },
});
