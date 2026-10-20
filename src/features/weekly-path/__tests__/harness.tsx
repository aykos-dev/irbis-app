/** Synthetic monthly path (shape of `GET /v1/path`); places are made up, no personal data. */
export const PLACE_IDS = {
  lake: '00000000-0000-4000-8000-0000000000d1',
  peak: '00000000-0000-4000-8000-0000000000d2',
  trail: '00000000-0000-4000-8000-0000000000d3',
};

function place(id: string, en: string, type: 'lake' | 'peak' | 'trail') {
  return {
    id,
    slug: en.toLowerCase().replace(/\s+/g, '-'),
    name: { uz: `${en} uz`, ru: `${en} ru`, en },
    type,
    difficulty: 1,
    requiredLevel: 1,
    elevationM: 1500,
  };
}

export function pathNode(position: number, overrides: Record<string, unknown> = {}) {
  const places = [
    place(PLACE_IDS.lake, 'Blue Lake', 'lake'),
    place(PLACE_IDS.peak, 'Big Peak', 'peak'),
    place(PLACE_IDS.trail, 'Long Trail', 'trail'),
  ];
  return {
    position,
    place: places[position - 1],
    status: 'go',
    reasons: [],
    weekendDay: 'sat',
    opensMonth: null,
    done: false,
    swap: null,
    ...overrides,
  };
}

export const weatherDays = [
  { date: '2026-10-16', day: 'fri', weatherCode: 0, tMaxC: 22, windKmh: 10 },
  { date: '2026-10-17', day: 'sat', weatherCode: 95, tMaxC: 18, windKmh: 40 },
  { date: '2026-10-18', day: 'sun', weatherCode: 3, tMaxC: 20, windKmh: 15 },
];

export const pathBody = (overrides: Record<string, unknown> = {}) => ({
  month: '2026-10',
  level: 1,
  nodes: [
    pathNode(1),
    pathNode(2, { status: 'caution', reasons: [{ code: 'WIND', day: 'sat', value: 45 }] }),
    pathNode(3, { status: 'seasonal_lock', opensMonth: 5 }),
  ],
  chest: { required: 3, done: 1, opened: false, xp: 100 },
  weather: { days: weatherDays },
  ...overrides,
});
