import type { XoMark } from '../../protocol/codec';

export type XoBoard = (XoMark | null)[];
export type XoLine = [number, number, number];

/** The 8 winning lines of the 3×3 board (cells 0–8, row by row): rows, columns, diagonals. */
export const LINES: readonly XoLine[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** The first line with 3 equal marks, or null. */
export function findWin(board: XoBoard): { mark: XoMark; line: XoLine } | null {
  for (const line of LINES) {
    const mark = board[line[0]];
    if (mark && board[line[1]] === mark && board[line[2]] === mark) {
      return { mark, line };
    }
  }
  return null;
}

/** Every cell has a mark. */
export function isFull(board: XoBoard): boolean {
  return board.every(cell => cell !== null);
}

export const emptyBoard = (): XoBoard => Array<XoMark | null>(9).fill(null);
