import { gameReducer, toMafiaPublic, type HostGame, type MafiaState } from '../../gameReducer';
import { defaultCounts } from '../roles';

const noShuffle = () => 0.99;
const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ seatId: `p${i + 1}`, connected: true }));

/** 5 players, no shuffle: p1 boss, p2 detective, p3 doctor, p4–p5 civilians. */
function started(revealOut: boolean): MafiaState {
  const game = gameReducer(null, {
    type: 'startMafia',
    settings: { counts: defaultCounts(5), revealOut },
    seats: players(5),
    rng: noShuffle,
  });
  if (game?.game !== 'mafia') {
    throw new Error('no mafia game');
  }
  return game;
}

function apply(state: MafiaState, ...actions: Parameters<typeof gameReducer>[1][]): MafiaState {
  const next = actions.reduce<HostGame | null>((game, action) => gameReducer(game, action), state);
  if (next?.game !== 'mafia') {
    throw new Error('no mafia game');
  }
  return next;
}

describe('campfire-mafia — narrator reducer (AC4)', () => {
  it('AC4: phases step Night 1 → Day 1 → Night 2', () => {
    const game = started(true);
    expect(apply(game, { type: 'mafPhaseNext' }).phase).toEqual({ kind: 'day', n: 1 });
    expect(apply(game, { type: 'mafPhaseNext' }, { type: 'mafPhaseNext' }).phase).toEqual({
      kind: 'night',
      n: 2,
    });
  });

  it('AC4: markOut stores seat, reason, phase and the role (reveal on); markBack removes it; repeats are ignored', () => {
    const game = started(true);
    const out = apply(game, { type: 'mafMarkOut', seatId: 'p1', reason: 'killed' });
    expect(out.out).toEqual([
      { seatId: 'p1', reason: 'killed', phase: { kind: 'night', n: 1 }, roleId: 'boss' },
    ]);
    expect(apply(out, { type: 'mafMarkOut', seatId: 'p1', reason: 'exiled' })).toBe(out);
    expect(apply(out, { type: 'mafMarkOut', seatId: 'p9', reason: 'exiled' })).toBe(out);

    const day = apply(out, { type: 'mafPhaseNext' }, { type: 'mafMarkOut', seatId: 'p2', reason: 'exiled' });
    expect(day.out[1]).toEqual({ seatId: 'p2', reason: 'exiled', phase: { kind: 'day', n: 1 }, roleId: 'detective' });

    const back = apply(day, { type: 'mafMarkBack', seatId: 'p1' });
    expect(back.out.map(entry => entry.seatId)).toEqual(['p2']);
    expect(apply(back, { type: 'mafMarkBack', seatId: 'p1' })).toBe(back);
  });

  it('AC5: reveal off — neither the host state nor the broadcast carries the role of a player who is out', () => {
    const game = apply(started(false), { type: 'mafMarkOut', seatId: 'p1', reason: 'killed' });
    expect(game.out[0]).not.toHaveProperty('roleId');
    expect(toMafiaPublic(game).out).toEqual([
      { seatId: 'p1', reason: 'killed', phase: { kind: 'night', n: 1 } },
    ]);
  });
});
