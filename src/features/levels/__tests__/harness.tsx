/** Synthetic level table and level bodies (shape of `/v1/levels` and `/v1/me/level`). */
type Lessons = { kind: 'count' | 'tier' | 'all'; tier: string | null; required: number };

function def(level: number, xp: number, lessons: Lessons, checkIns: [number, number], spots = 0) {
  return {
    level,
    xp,
    lessons,
    checkIns: { required: checkIns[0], minDifficulty: checkIns[1] },
    verifiedSpots: spots,
    maxDifficulty: Math.min(level, 5),
    newPlacesCount: level,
  };
}

export const levelDefs = [
  def(1, 0, { kind: 'count', tier: null, required: 0 }, [0, 1]),
  def(2, 300, { kind: 'count', tier: null, required: 2 }, [2, 1]),
  def(3, 1000, { kind: 'tier', tier: '2', required: 4 }, [5, 2]),
  def(4, 2500, { kind: 'tier', tier: '3', required: 6 }, [8, 3]),
  def(5, 5000, { kind: 'tier', tier: 'first-aid', required: 4 }, [12, 3]),
  def(6, 9000, { kind: 'tier', tier: '5', required: 4 }, [15, 4]),
  def(7, 15000, { kind: 'all', tier: null, required: 30 }, [25, 5], 3),
];

export const levelsBody = { items: levelDefs };

export const myLevelBody = (overrides: Record<string, unknown> = {}) => ({
  level: 3,
  xpTotal: 1240,
  reachedAt: '2026-08-15T12:00:00.000Z',
  next: {
    level: 4,
    xp: { current: 1240, required: 2500 },
    lessons: { current: 4, required: 6, kind: 'tier', tier: '3' },
    checkIns: { current: 5, required: 8, minDifficulty: 3 },
    verifiedSpots: null,
  },
  pendingLevelUps: [],
  ...overrides,
});
