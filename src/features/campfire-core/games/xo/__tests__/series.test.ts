import { gameReducer, type HostAction, type XoState } from '../../gameReducer';

const seats = [
  { seatId: 'host', connected: true },
  { seatId: 'p1', connected: true },
];

function run(state: XoState, ...actions: HostAction[]): XoState {
  return actions.reduce<XoState>((current, action) => {
    const next = gameReducer(current, action);
    if (next?.game !== 'xo') {
      throw new Error('xo ended');
    }
    return next;
  }, state);
}

function start(): XoState {
  const state = gameReducer(null, { type: 'startXo', seats, hostSeatId: 'host' });
  if (state?.game !== 'xo') {
    throw new Error('xo did not start');
  }
  return state;
}

const move = (seatId: string, cell: number, gameNo = 1): HostAction => ({
  type: 'xoMove',
  seatId,
  round: 1,
  gameNo,
  cell,
});

/** Game 1: host (X) wins the top row. */
const hostWins = (state: XoState) =>
  run(state, move('host', 0), move('p1', 3), move('host', 1), move('p1', 4), move('host', 2));

/** A draw from the given X / O seats: x o x / x o o / o x x. */
const draw = (state: XoState, x: string, o: string, gameNo: number) =>
  run(
    state,
    move(x, 0, gameNo),
    move(o, 1, gameNo),
    move(x, 2, gameNo),
    move(o, 4, gameNo),
    move(x, 3, gameNo),
    move(o, 5, gameNo),
    move(x, 7, gameNo),
    move(o, 6, gameNo),
    move(x, 8, gameNo),
  );

describe('campfire-xo — series reducer (AC4–AC7)', () => {
  it('AC4: next swaps marks, empties the board, X first; stale gameNo or no result is ignored', () => {
    const fresh = start();
    expect(run(fresh, { type: 'xoNext', round: 1, gameNo: 1 })).toBe(fresh);

    const won = hostWins(fresh);
    expect(run(won, { type: 'xoNext', round: 1, gameNo: 2 })).toBe(won);
    const next = run(won, { type: 'xoNext', round: 1, gameNo: 1 });
    expect(next).toMatchObject({
      board: Array(9).fill(null),
      gameNo: 2,
      xSeatId: 'p1',
      oSeatId: 'host',
      turn: 'x',
      result: null,
    });
    // A second tap for the old game (both phones tapped) changes nothing.
    expect(run(next, { type: 'xoNext', round: 1, gameNo: 1 })).toBe(next);
  });

  it('AC5: wins and draws carry across games', () => {
    const second = run(hostWins(start()), { type: 'xoNext', round: 1, gameNo: 1 });
    const drawn = draw(second, 'p1', 'host', 2);
    expect(drawn).toMatchObject({ score: { host: 1, p1: 0 }, draws: 1, result: { kind: 'draw' } });
  });

  it('AC6: a dropped player pauses and blocks moves; back on the same seat resumes the same board', () => {
    const begun = run(start(), move('host', 4));
    const paused = run(begun, {
      type: 'xoPresence',
      seats: [
        { seatId: 'host', connected: true },
        { seatId: 'p1', connected: false },
      ],
    });
    expect(paused.paused).toBe(true);
    expect(run(paused, move('p1', 0))).toBe(paused);

    const back = run(paused, { type: 'xoPresence', seats });
    expect(back).toEqual({ ...begun, paused: false });
  });

  it('AC6/AC7: removing the player ends the series; End shows games, draws, score; play again resets', () => {
    const won = hostWins(start());
    expect(run(won, { type: 'seatRemoved', seatId: 'p1' }).ended).toEqual({
      games: 1,
      draws: 0,
      score: { host: 1, p1: 0 },
    });

    const second = run(won, { type: 'xoNext', round: 1, gameNo: 1 });
    const ended = run(draw(second, 'p1', 'host', 2), { type: 'xoEnd' });
    expect(ended.ended).toEqual({ games: 2, draws: 1, score: { host: 1, p1: 0 } });
    expect(run(ended, move('p1', 0, 2))).toBe(ended);

    const again = run(ended, { type: 'xoPlayAgain', seats, hostSeatId: 'host' });
    expect(again).toMatchObject({
      round: 2,
      gameNo: 1,
      xSeatId: 'host',
      oSeatId: 'p1',
      score: { host: 0, p1: 0 },
      draws: 0,
      result: null,
      paused: false,
    });
    expect(again.ended).toBeUndefined();
  });
});
