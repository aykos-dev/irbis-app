import { gameReducer, toMafiaPublic, type HostGame, type MafiaState } from '../../gameReducer';
import { defaultCounts, type RoleId } from '../roles';
import { winCheck } from '../winCheck';

const noShuffle = () => 0.99;
const players = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ seatId: `p${i + 1}`, connected: true }));

/** p1 boss, p2 mafia, p3 detective, p4 doctor, p5 maniac, p6–p7 civilians. */
const table: Record<string, RoleId> = {
  p1: 'boss',
  p2: 'mafia',
  p3: 'detective',
  p4: 'doctor',
  p5: 'maniac',
  p6: 'civilian',
  p7: 'civilian',
};

describe('campfire-mafia — win check (AC6)', () => {
  it.each([
    ['nobody out', [], null],
    ['maniac and one other left → maniac', ['p1', 'p2', 'p3', 'p4', 'p6'], 'maniac'],
    ['maniac + boss left: maniac comes before mafia', ['p2', 'p3', 'p4', 'p6', 'p7'], 'maniac'],
    ['no mafia, no maniac → town', ['p1', 'p2', 'p5'], 'town'],
    ['no mafia but the maniac lives → no winner yet', ['p1', 'p2'], null],
    ['mafia equal to everyone else → mafia', ['p3', 'p4', 'p5'], 'mafia'],
    ['mafia one short → no winner', ['p3', 'p4'], null],
  ] as const)('%s', (_name, out, winner) => {
    expect(winCheck(table, out)).toBe(winner);
  });
});

function ended(): MafiaState {
  const states: Parameters<typeof gameReducer>[1][] = [
    { type: 'mafMarkOut', seatId: 'p3', reason: 'killed' },
    { type: 'end', winner: 'town' },
  ];
  const game = states.reduce<HostGame | null>(
    (state, action) => gameReducer(state, action),
    gameReducer(null, {
      type: 'startMafia',
      settings: { counts: defaultCounts(6), revealOut: false },
      seats: players(6),
      rng: noShuffle,
    }),
  );
  if (game?.game !== 'mafia') {
    throw new Error('no mafia game');
  }
  return game;
}

describe('campfire-mafia — game over and play again (AC6)', () => {
  it('AC6: end with a winner keeps the game, freezes marks and publishes every role', () => {
    const game = ended();
    expect(game.ended).toEqual({ winner: 'town' });
    expect(gameReducer(game, { type: 'mafMarkOut', seatId: 'p1', reason: 'killed' })).toBe(game);
    expect(toMafiaPublic(game).ended).toEqual({
      winner: 'town',
      roles: { p1: 'boss', p2: 'mafia', p3: 'detective', p4: 'doctor', p5: 'civilian', p6: 'civilian' },
    });
    expect(gameReducer(game, { type: 'end' })).toBeNull();
  });

  it('AC6: play again re-deals the same counts to the connected seats, round + 1; blocked deal keeps the state', () => {
    const game = ended();
    const seats = players(6).map(seat => (seat.seatId === 'p6' ? { ...seat, connected: false } : seat));
    const again = gameReducer(game, { type: 'playAgain', seats, rng: noShuffle });
    expect(again).toMatchObject({
      game: 'mafia',
      round: 2,
      phase: { kind: 'night', n: 1 },
      players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      out: [],
      ready: [],
      revealOut: false,
      counts: game.counts,
    });
    expect(again && 'ended' in again ? again.ended : undefined).toBeUndefined();
    expect(gameReducer(game, { type: 'playAgain', seats: players(4), rng: noShuffle })).toBe(game);
  });
});
