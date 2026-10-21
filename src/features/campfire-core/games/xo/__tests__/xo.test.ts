import { gameReducer, type XoState } from '../../gameReducer';
import { findWin, isFull, LINES, type XoBoard } from '../xoRules';

const seats = [
  { seatId: 'host', connected: true },
  { seatId: 'p1', connected: true },
];

function start(): XoState {
  const state = gameReducer(null, { type: 'startXo', seats, hostSeatId: 'host' });
  if (state?.game !== 'xo') {
    throw new Error('xo did not start');
  }
  return state;
}

function play(state: XoState, ...moves: [string, number][]): XoState {
  return moves.reduce<XoState>((current, [seatId, cell]) => {
    const next = gameReducer(current, {
      type: 'xoMove',
      seatId,
      round: 1,
      gameNo: current.gameNo,
      cell,
    });
    if (next?.game !== 'xo') {
      throw new Error('xo ended');
    }
    return next;
  }, state);
}

describe('campfire-xo — rules (AC3)', () => {
  it('AC3: findWin finds every one of the 8 lines for both marks, and nothing on a no-win board', () => {
    expect(LINES).toHaveLength(8);
    LINES.forEach(line => {
      (['x', 'o'] as const).forEach(mark => {
        const board: XoBoard = Array(9).fill(null);
        line.forEach(cell => {
          board[cell] = mark;
        });
        expect(findWin(board)).toEqual({ mark, line });
      });
    });
    const full: XoBoard = ['x', 'o', 'x', 'x', 'o', 'o', 'o', 'x', 'x'];
    expect(findWin(full)).toBeNull();
    expect(isFull(full)).toBe(true);
    expect(isFull(Array(9).fill(null))).toBe(false);
  });
});

describe('campfire-xo — reducer (AC2, AC3)', () => {
  it('AC2: start makes the host X, the joiner O, X to move; not with 1 or 3 seats', () => {
    expect(start()).toEqual({
      game: 'xo',
      round: 1,
      players: ['host', 'p1'],
      waiting: [],
      board: Array(9).fill(null),
      xSeatId: 'host',
      oSeatId: 'p1',
      turn: 'x',
      result: null,
      score: { host: 0, p1: 0 },
      draws: 0,
      gameNo: 1,
      paused: false,
    });
    expect(gameReducer(null, { type: 'startXo', seats: seats.slice(0, 1), hostSeatId: 'host' })).toBeNull();
    expect(
      gameReducer(null, {
        type: 'startXo',
        seats: [...seats, { seatId: 'p2', connected: true }],
        hostSeatId: 'host',
      }),
    ).toBeNull();
  });

  it('AC2: out of turn, a taken cell, an old gameNo, a paused game and moves after the result are ignored', () => {
    const begun = start();
    const xo = (state: XoState, seatId: string, cell: number, gameNo = state.gameNo) =>
      gameReducer(state, { type: 'xoMove', seatId, round: 1, gameNo, cell });

    expect(xo(begun, 'p1', 0)).toBe(begun);
    expect(xo(begun, 'p2', 0)).toBe(begun);
    expect(xo(begun, 'host', 0, 2)).toBe(begun);
    expect(xo(begun, 'host', 9)).toBe(begun);
    expect(xo({ ...begun, paused: true }, 'host', 0)).toEqual({ ...begun, paused: true });

    const moved = play(begun, ['host', 4]);
    expect(moved.board[4]).toBe('x');
    expect(moved.turn).toBe('o');
    expect(xo(moved, 'p1', 4)).toBe(moved);

    const won = play(begun, ['host', 0], ['p1', 3], ['host', 1], ['p1', 4], ['host', 2]);
    expect(xo(won, 'p1', 5)).toBe(won);
  });

  it('AC3: a win adds 1 to the winner with the line; a full board is a draw', () => {
    const won = play(start(), ['host', 0], ['p1', 3], ['host', 1], ['p1', 4], ['host', 2]);
    expect(won.result).toEqual({ kind: 'win', mark: 'x', line: [0, 1, 2] });
    expect(won.score).toEqual({ host: 1, p1: 0 });

    const oWins = play(start(), ['host', 0], ['p1', 2], ['host', 1], ['p1', 4], ['host', 8], ['p1', 6]);
    expect(oWins.result).toEqual({ kind: 'win', mark: 'o', line: [2, 4, 6] });
    expect(oWins.score).toEqual({ host: 0, p1: 1 });

    const drawn = play(
      start(),
      ['host', 0], ['p1', 1], ['host', 2], ['p1', 4], ['host', 3],
      ['p1', 5], ['host', 7], ['p1', 6], ['host', 8],
    );
    expect(drawn.result).toEqual({ kind: 'draw' });
    expect(drawn.draws).toBe(1);
    expect(drawn.score).toEqual({ host: 0, p1: 0 });
  });
});
