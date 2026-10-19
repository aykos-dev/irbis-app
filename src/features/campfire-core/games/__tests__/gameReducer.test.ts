import {
  decodeHost,
  encode,
  type Secret,
} from '../../protocol/codec';
import {
  gameReducer,
  toPublic,
  type GameAction,
  type GameSeat,
  type GameState,
} from '../gameReducer';

/** Deterministic rng: always the first candidate after a shuffle. */
const rng = () => 0;

const seats = (n: number, offline: string[] = []): GameSeat[] => [
  { seatId: 'host', connected: true },
  ...Array.from({ length: n }, (_, i) => ({
    seatId: `p${i + 1}`,
    connected: !offline.includes(`p${i + 1}`),
  })),
];

function start(
  game: 'imposter' | 'whoami' | 'rather',
  players: GameSeat[],
  ids: string[],
  imposters = 1,
): GameState {
  const state = gameReducer(null, {
    type: 'start',
    game,
    settings: { packId: `${game}-pack_1`, imposters, showCategory: true },
    seats: players,
    ids,
    rng,
  });
  if (!state) {
    throw new Error('not started');
  }
  return state;
}

const run = (state: GameState, ...actions: GameAction[]) =>
  actions.reduce<GameState | null>(
    (current, action) => gameReducer(current, action),
    state,
  );

describe('campfire-party — game engine (AC2)', () => {
  it('AC2: Imposter deals the word to everyone but the imposter; the broadcast never carries it', () => {
    const state = start('imposter', seats(3, ['p3']), ['word_1']);

    expect(state.players).toEqual(['host', 'p1', 'p2']);
    const roles = Object.values(state.deals).map(deal =>
      'role' in deal ? deal.role : null,
    );
    expect(roles.filter(role => role === 'imposter')).toHaveLength(1);
    expect(roles.filter(role => role === 'word')).toHaveLength(2);
    const imposter = state.imposterSeats[0] ?? '';
    expect(state.deals[imposter]).toEqual({
      role: 'imposter',
      packId: 'imposter-pack_1',
      showCategory: true,
    });

    const line = encode({
      type: 'game',
      game: 'imposter',
      round: 1,
      phase: state.phase,
      public: toPublic(state),
    });
    expect(line).not.toContain('word_1');
    expect(decodeHost(line)).toMatchObject({
      ok: true,
      message: { public: { players: ['host', 'p1', 'p2'], imposters: 1 } },
    });
  });

  it('AC2: Who am I shows each seat the others\' characters, never its own or any in the broadcast', () => {
    const state = start('whoami', seats(2), ['char_a', 'char_b', 'char_c']);
    const own = (seatId: string) =>
      Object.entries(state.deals)
        .filter(([other]) => other !== seatId)
        .flatMap(([, deal]: [string, Secret]) =>
          'others' in deal ? deal.others : [],
        )
        .find(entry => entry.seatId === seatId)?.characterId;

    ['host', 'p1', 'p2'].forEach(seatId => {
      const deal = state.deals[seatId];
      const others = deal && 'others' in deal ? deal.others : [];
      expect(others.map(entry => entry.seatId)).not.toContain(seatId);
      expect(others).toHaveLength(2);
      expect(others.map(entry => entry.characterId)).not.toContain(own(seatId));
    });
    expect(JSON.stringify(toPublic(state))).not.toMatch(/char_/);
  });

  it('AC2: a reconnecting seat keeps its deal; a late joiner waits and plays from the next round; end clears', () => {
    const state = start('imposter', seats(3, ['p3']), ['word_1']);

    expect(run(state, { type: 'seatJoined', seatId: 'p1' })).toBe(state);

    const late = run(state, { type: 'seatJoined', seatId: 'p3' });
    expect(late?.waiting).toEqual(['p3']);
    expect(late?.deals.p3).toBeUndefined();

    const next = late
      ? gameReducer(late, { type: 'newRound', seats: seats(3), ids: ['word_2'], rng })
      : null;
    expect(next).toMatchObject({ round: 2, waiting: [], players: ['host', 'p1', 'p2', 'p3'] });
    expect(next?.deals.p3).toBeDefined();

    const removed = next ? gameReducer(next, { type: 'seatRemoved', seatId: 'p2' }) : null;
    expect(removed?.players).not.toContain('p2');
    expect(removed?.deals.p2).toBeUndefined();

    expect(removed ? gameReducer(removed, { type: 'end' }) : 'not reached').toBeNull();
  });

  it('AC2: two imposters only with 8+ players; Would you rather takes 20 questions and counts one vote per seat', () => {
    expect(start('imposter', seats(6), ['w'], 2).imposterSeats).toHaveLength(1);
    expect(start('imposter', seats(7), ['w'], 2).imposterSeats).toHaveLength(2);

    const ids = Array.from({ length: 20 }, (_, i) => `q${i}`);
    const rather = start('rather', seats(1), ids);
    expect(rather).toMatchObject({ phase: 'voting', deals: {}, qIndex: 0 });
    const voted = run(
      rather,
      { type: 'wyrVote', seatId: 'p1', round: 1, qIndex: 0, pick: 'a' },
      { type: 'wyrVote', seatId: 'p1', round: 1, qIndex: 0, pick: 'b' },
      { type: 'wyrVote', seatId: 'p9', round: 1, qIndex: 0, pick: 'a' },
      { type: 'wyrReveal' },
    );
    expect(voted && toPublic(voted)).toMatchObject({
      questionId: 'q0',
      total: 20,
      tally: { a: 0, b: 1 },
    });
  });
});
