import { gameReducer, toMafiaPublic, type HostGame } from '../../gameReducer';
import {
  balance,
  civilians,
  dealBlocked,
  dealRoles,
  defaultCounts,
  teamCounts,
  type MafiaCounts,
} from '../roles';

const counts = (overrides: Partial<MafiaCounts>): MafiaCounts => ({
  ...defaultCounts(6),
  ...overrides,
});

/** A fixed pseudo-random sequence, so the shuffle is not the identity. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ seatId: `p${i + 1}`, connected: true }));

describe('campfire-mafia — role maths (AC1)', () => {
  it('AC1: defaults, civilians, balance, team counts and the first disabled reason', () => {
    expect(defaultCounts(5)).toMatchObject({ boss: 1, mafia: 0, detective: 1, doctor: 1, maniac: 0 });
    expect(defaultCounts(12)).toMatchObject({ boss: 1, mafia: 3 });

    expect(civilians(defaultCounts(8), 8)).toBe(4);
    expect(civilians(counts({ lover: 9 }), 8)).toBe(0);
    expect(teamCounts(counts({ maniac: 1 }), 8)).toEqual({ town: 5, mafia: 2, solo: 1 });

    // n = 9: lo = 2, hi = 3.
    expect(balance(counts({ boss: 1, mafia: 0 }), 9)).toBe('townHeavy');
    expect(balance(counts({ boss: 1, mafia: 1 }), 9)).toBe('balanced');
    expect(balance(counts({ boss: 1, mafia: 2 }), 9)).toBe('balanced');
    expect(balance(counts({ boss: 1, mafia: 3 }), 9)).toBe('mafiaHeavy');

    expect(dealBlocked(counts({ boss: 0, mafia: 0, lover: 9 }), 4)).toBe('needPlayers');
    expect(dealBlocked(counts({ boss: 0, mafia: 0, lover: 9 }), 5)).toBe('tooMany');
    expect(dealBlocked(counts({ boss: 0, mafia: 0 }), 5)).toBe('needMafia');
    expect(dealBlocked(defaultCounts(5), 5)).toBeNull();
  });
});

describe('campfire-mafia — deal (AC2)', () => {
  it('AC2: every chosen role is dealt exactly once, civilians fill the rest; the rng decides who', () => {
    const chosen = counts({ boss: 1, mafia: 1, detective: 1, doctor: 1, maniac: 1, sniper: 1 });
    const seats = players(9).map(seat => seat.seatId);
    const first = dealRoles(chosen, seats, seq([0.9, 0.1, 0.5, 0.3, 0.7]));
    const second = dealRoles(chosen, seats, seq([0.2, 0.8, 0.4]));

    const dealt = Object.values(first).sort();
    expect(dealt).toEqual(
      ['boss', 'mafia', 'detective', 'doctor', 'maniac', 'sniper', 'civilian', 'civilian', 'civilian'].sort(),
    );
    expect(Object.keys(first).sort()).toEqual([...seats].sort());
    expect(first).not.toEqual(second);
  });

  it('AC2: start → night 1 public state; a joiner waits, a removed player is out (exiled), ready counts', () => {
    const state = gameReducer(null, {
      type: 'startMafia',
      settings: { counts: defaultCounts(6), revealOut: true },
      seats: [...players(6), { seatId: 'p7', connected: false }],
      rng: () => 0,
    });
    if (state?.game !== 'mafia') {
      throw new Error('not started');
    }
    expect(state.players).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(toMafiaPublic(state)).toEqual({
      phase: { kind: 'night', n: 1 },
      readyCount: 0,
      playerCount: 6,
      out: [],
      revealOut: true,
    });

    const run = (...actions: Parameters<typeof gameReducer>[1][]) =>
      actions.reduce<HostGame | null>((current, action) => gameReducer(current, action), state);
    const next = run(
      { type: 'seatJoined', seatId: 'p1' },
      { type: 'seatJoined', seatId: 'p7' },
      { type: 'mafReady', seatId: 'p2', round: 1 },
      { type: 'mafReady', seatId: 'p2', round: 1 },
      { type: 'seatRemoved', seatId: 'p3' },
    );
    if (next?.game !== 'mafia') {
      throw new Error('lost the game');
    }
    expect(next.waiting).toEqual(['p7']);
    expect(next.deals.p7).toBeUndefined();
    expect(toMafiaPublic(next)).toMatchObject({
      readyCount: 1,
      out: [{ seatId: 'p3', reason: 'exiled', phase: { kind: 'night', n: 1 }, roleId: state.deals.p3?.roleId }],
    });
    expect(toMafiaPublic({ ...next, revealOut: false }).out[0]).not.toHaveProperty('roleId');
    expect(gameReducer(next, { type: 'end' })).toBeNull();
  });
});
