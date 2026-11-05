import { decodeClient } from '../../../protocol/codec';
import { gameReducer, type GeoState, type HostAction } from '../../gameReducer';
import { countries } from '../geoData';
import { geoRanks, toGeoPublic } from '../geoGame';

const seats = ['host', 'p1', 'p2'];
const promptIds = countries.slice(0, 10).map(country => country.id);
const first = countries[0];

function apply(state: GeoState | null, ...actions: HostAction[]): GeoState {
  const next = actions.reduce<ReturnType<typeof gameReducer>>(
    (current, action) => gameReducer(current, action),
    state,
  );
  if (next?.game !== 'geo') {
    throw new Error('no geo game');
  }
  return next;
}

const started = () =>
  apply(null, { type: 'startGeo', mode: 'findCountry', seats, now: 1000, promptIds });

/** A guess on the round-1 country's own centroid (scores 1000). */
const guess = (seatId: string, extra: Partial<Extract<HostAction, { type: 'geoGuess' }>> = {}): HostAction => ({
  type: 'geoGuess',
  seatId,
  round: 1,
  roundNo: 1,
  lat: first?.lat ?? 0,
  lng: first?.lng ?? 0,
  now: 2000,
  connected: seats,
  ...extra,
});

describe('campfire-geocore — round engine', () => {
  it('start: question 1 of 10 with 10 prompts, a 20 s deadline and 0 for every seat', () => {
    const state = started();
    expect(state).toMatchObject({
      phase: 'question',
      roundNo: 1,
      of: 10,
      endsAt: 21000,
      seats,
      totals: { host: 0, p1: 0, p2: 0 },
    });
    expect(state.promptIds).toHaveLength(10);
    expect(gameReducer(null, { type: 'startGeo', mode: 'findCountry', seats, now: 0, promptIds: ['x'] })).toBeNull();
  });

  it('guess counts once; stale, late, wrong-phase or unknown-seat guesses change nothing; never public before reveal', () => {
    const state = apply(started(), guess('p1'));
    expect(Object.keys(state.guesses)).toEqual(['p1']);
    expect(toGeoPublic(state, 2000)).toMatchObject({ answered: ['p1'], reveal: null, remainingMs: 19000 });
    expect(JSON.stringify(toGeoPublic(state, 2000))).not.toContain(String(first?.lat));
    expect(gameReducer(state, guess('p1', { lat: 0 }))).toBe(state);
    expect(gameReducer(state, guess('p2', { roundNo: 2 }))).toBe(state);
    expect(gameReducer(state, guess('p2', { round: 2 }))).toBe(state);
    expect(gameReducer(state, guess('p2', { now: 21001 }))).toBe(state);
    expect(gameReducer(state, guess('p9'))).toBe(state);
    const revealed = apply(state, { type: 'geoTimeUp', roundNo: 1, now: 21000 });
    expect(gameReducer(revealed, guess('p2'))).toBe(revealed);
    expect(gameReducer(revealed, { type: 'geoTimeUp', roundNo: 1, now: 22000 })).toBe(revealed);
  });

  it('all connected seats answered closes early; time up scores the missing seats 0', () => {
    const early = apply(started(), guess('host'), guess('p1', { connected: ['host', 'p1'] }));
    expect(early).toMatchObject({ phase: 'reveal', revealEndsAt: 10000, totals: { host: 1000, p1: 1000, p2: 0 } });
    expect(toGeoPublic(early, 2000).reveal?.answer).toMatchObject({ iso: first?.iso });

    const late = apply(started(), guess('p1'), { type: 'geoTimeUp', roundNo: 1, now: 21000 });
    expect(late.lastReveal?.results).toEqual([
      { seatId: 'host', km: null, points: 0 },
      expect.objectContaining({ seatId: 'p1', points: 1000 }),
      { seatId: 'p2', km: null, points: 0 },
    ]);
    expect(late.totals).toEqual({ host: 0, p1: 1000, p2: 0 });
  });

  it('reveal → next → … → final after round 10; play again resets the totals with new seats', () => {
    let state = started();
    for (let roundNo = 1; roundNo <= 10; roundNo += 1) {
      expect(state).toMatchObject({ phase: 'question', roundNo, guesses: {} });
      state = apply(state, guess('p1', { roundNo, now: 1000 }), { type: 'geoTimeUp', roundNo, now: 5000 });
      expect(gameReducer(state, { type: 'geoNext', roundNo: roundNo - 1, now: 6000 })).toBe(state);
      state = apply(state, { type: 'geoNext', roundNo, now: 6000 });
    }
    expect(state.phase).toBe('final');
    expect(toGeoPublic(state).reveal?.roundNo).toBe(10);
    const again = apply(state, { type: 'geoPlayAgain', now: 0, promptIds, seats: ['host', 'p3'] });
    expect(again).toMatchObject({ phase: 'question', round: 2, roundNo: 1, seats: ['host', 'p3'], totals: { host: 0, p3: 0 } });
  });

  it('final ranks: equal totals share a place and the next place skips (1, 2, 3, 3, 5)', () => {
    expect(geoRanks({ a: 900, b: 4000, c: 500, d: 900, e: 3000 }).map(rank => [rank.seatId, rank.place])).toEqual([
      ['b', 1],
      ['e', 2],
      ['a', 3],
      ['d', 3],
      ['c', 5],
    ]);
  });

  it('ranks negative totals (pin games can lose points) below 0', () => {
    expect(geoRanks({ a: -350, b: 0, c: 650, d: -1200 }).map(rank => [rank.seatId, rank.place])).toEqual([
      ['c', 1],
      ['b', 2],
      ['a', 3],
      ['d', 4],
    ]);
  });
});

describe('campfire-geocore — protocol v6', () => {
  it('v6 carries geoGuess, rejects a v5 phone and an out-of-range point', () => {
    expect(decodeClient('{"v":6,"type":"geoGuess","round":1,"roundNo":3,"lat":41.3,"lng":69.2,"iso":"UZ"}')).toEqual({
      ok: true,
      message: { v: 6, type: 'geoGuess', round: 1, roundNo: 3, lat: 41.3, lng: 69.2, iso: 'UZ' },
    });
    expect(decodeClient('{"v":5,"type":"geoGuess","round":1,"roundNo":3,"lat":1,"lng":1}')).toEqual({ ok: false, reason: 'version' });
    expect(decodeClient('{"v":6,"type":"geoGuess","round":1,"roundNo":3,"lat":90.5,"lng":1}')).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeClient('{"v":6,"type":"geoGuess","round":1,"roundNo":3,"lat":1,"lng":180.5}')).toEqual({ ok: false, reason: 'invalid' });
  });
});
