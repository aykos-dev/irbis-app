import { DEBUG_GRANT, parseGrantQuery, toGrantBody } from '../grantLink';

describe('debug — QA level grant link (levels AC8)', () => {
  it('parses every optional count and the tier; ignores unreadable values and unknown keys', () => {
    expect(parseGrantQuery('xp=500&lessons=3&tier=first-aid&checkins=2&difficulty=3&spots=1')).toEqual({
      grant: true,
      xp: 500,
      lessons: 3,
      tier: 'first-aid',
      checkins: 2,
      difficulty: 3,
      spots: 1,
    });
    expect(parseGrantQuery('xp=abc&lessons=-1&spots=2.5&foo=1')).toEqual({ grant: true });
    expect(parseGrantQuery('')).toEqual({ grant: true });
  });

  it('builds the grant body: N lessons of the tier (default "1"), N check-ins at the difficulty (default 1)', () => {
    expect(toGrantBody({ grant: true, lessons: 2, checkins: 3 })).toEqual({
      lessons: [{ tier: '1' }, { tier: '1' }],
      checkIns: [{ difficulty: 1 }, { difficulty: 1 }, { difficulty: 1 }],
    });
    expect(toGrantBody({ grant: true, xp: 300, lessons: 1, tier: '3', checkins: 1, difficulty: 4, spots: 0 })).toEqual({
      xp: 300,
      lessons: [{ tier: '3' }],
      checkIns: [{ difficulty: 4 }],
      verifiedSpots: 0,
    });
  });

  it('matches the grant path with or without a query', () => {
    expect(DEBUG_GRANT.exec('debug/levels/grant?xp=1')?.[1]).toBe('xp=1');
    expect(DEBUG_GRANT.exec('/debug/levels/grant')).not.toBeNull();
    expect(DEBUG_GRANT.exec('debug/levels/granted')).toBeNull();
  });
});
