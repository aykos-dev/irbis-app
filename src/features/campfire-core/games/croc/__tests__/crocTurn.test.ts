import {
  gameReducer,
  toCrocPublic,
  type CrocState,
  type GameSeat,
  type HostAction,
} from '../../gameReducer';

const seats: GameSeat[] = ['host', 'p1', 'p2'].map(seatId => ({ seatId, connected: true }));
const settings = { durationSec: 60, packs: ['croc-animals'] };
const camel = { id: 'camel', pack: 'croc-animals' };

function apply(state: CrocState | null, ...actions: HostAction[]): CrocState {
  const next = actions.reduce<ReturnType<typeof gameReducer>>(
    (current, action) => gameReducer(current, action),
    state,
  );
  if (next?.game !== 'croc') {
    throw new Error('no croc game');
  }
  return next;
}

/** p1 shows camel; the turn started at t = 1000 ms on the host's clock. */
function running(): CrocState {
  return apply(
    null,
    { type: 'startCroc', settings, seats },
    { type: 'crocPick', seatId: 'p1', word: camel },
    { type: 'crocStart', seatId: 'p1', round: 1, turnNo: 1, now: 1000 },
  );
}

const guessed = { type: 'crocGuessed' as const, seatId: 'p1', round: 1 };

describe('campfire-crocodile — turn engine (AC4, AC5)', () => {
  it('AC4: Start runs the turn; the broadcast stamps the time left, never the word; Skip still works', () => {
    const state = running();
    expect(state.phase).toBe('running');
    expect(toCrocPublic(state, 1000)).toMatchObject({ phase: 'running', remainingMs: 60000 });
    expect(toCrocPublic(state, 21000).remainingMs).toBe(40000);
    expect(JSON.stringify(toCrocPublic(state, 1000))).not.toContain('camel');
    const skipped = apply(state, {
      type: 'crocSkip',
      seatId: 'p1',
      round: 1,
      turnNo: 1,
      word: { id: 'saiga', pack: 'croc-animals' },
    });
    expect(skipped).toMatchObject({ phase: 'running', endsAt: state.endsAt, totals: { skipped: 1 } });
  });

  it('AC5: Guessed! and time up both end the turn with the word; only a guess counts as guessed', () => {
    const won = apply(running(), { ...guessed, turnNo: 1 });
    expect(won).toMatchObject({
      phase: 'result',
      result: { kind: 'guessed', word: camel },
      totals: { guessed: 1, turns: 1 },
    });
    expect(toCrocPublic(won, 0).result).toEqual({ kind: 'guessed', word: camel });
    const lost = apply(running(), { type: 'crocTimeUp', turnNo: 1 });
    expect(lost).toMatchObject({
      phase: 'result',
      result: { kind: 'timeUp', word: camel },
      totals: { guessed: 0, turns: 1 },
    });
    expect(apply(lost, { type: 'crocNext' })).toMatchObject({ phase: 'pick', turnNo: 1 });
  });

  it('AC5: a stale turn, a non-describer, a guess after the turn ended or a late time up change nothing', () => {
    const state = running();
    expect(gameReducer(state, { ...guessed, turnNo: 0 })).toBe(state);
    expect(gameReducer(state, { ...guessed, seatId: 'p2', turnNo: 1 })).toBe(state);
    expect(gameReducer(state, { type: 'crocTimeUp', turnNo: 0 })).toBe(state);
    const ended = apply(state, { type: 'crocTimeUp', turnNo: 1 });
    expect(gameReducer(ended, { ...guessed, turnNo: 1 })).toBe(ended);
  });
});

describe('campfire-crocodile — leaving and resume (AC6)', () => {
  it('AC6: the describer leaving during ready or running cancels the turn without counting it', () => {
    const left = { type: 'crocLeft' as const, seatId: 'p1', name: 'guest_1' };
    const ready = apply(null, { type: 'startCroc', settings, seats }, { type: 'crocPick', seatId: 'p1', word: camel });
    [ready, running()].forEach(state => {
      expect(apply(state, left)).toMatchObject({
        phase: 'result',
        result: { kind: 'cancelled', word: camel, name: 'guest_1' },
        totals: { guessed: 0, turns: 0 },
      });
    });
    const other = running();
    expect(gameReducer(other, { ...left, seatId: 'p2' })).toBe(other);
  });

  it('AC6: a host restart resumes a running turn in ready with the same describer and word', () => {
    const resumed = apply(running(), { type: 'resumed' });
    expect(resumed).toMatchObject({ phase: 'ready', describerSeatId: 'p1', word: camel, turnNo: 1 });
    expect(resumed.endsAt).toBeUndefined();
    const result = apply(running(), { type: 'crocTimeUp', turnNo: 1 }, { type: 'resumed' });
    expect(result.phase).toBe('pick');
  });
});

describe('campfire-crocodile — end and play again (AC7)', () => {
  it('AC7: End from any phase shows the totals; Play again resets them with the same settings', () => {
    const over = apply(running(), { ...guessed, turnNo: 1 }, { type: 'crocEnd' });
    expect(over).toMatchObject({ phase: 'ended', totals: { guessed: 1, skipped: 0, turns: 1 } });
    expect(toCrocPublic(over, 0)).toEqual({
      phase: 'ended',
      turnNo: 1,
      durationSec: 60,
      totals: { guessed: 1, skipped: 0, turns: 1 },
    });
    expect(apply(over, { ...guessed, turnNo: 1 })).toBe(over);
    const again = apply(over, { type: 'playAgain', seats, rng: Math.random });
    expect(again).toMatchObject({
      phase: 'pick',
      turnNo: 0,
      durationSec: 60,
      packs: ['croc-animals'],
      totals: { guessed: 0, skipped: 0, turns: 0 },
    });
    expect(again.word).toBeUndefined();
    expect(gameReducer(again, { type: 'end' })).toBeNull();
  });
});
