import type { LessonIcon } from '../../../shared/api/generated/model';

/** Synthetic lesson catalog (shape of `GET /v1/lessons`). */
export const LESSON_IDS = {
  compass: '00000000-0000-4000-8000-0000000000b1',
  leaf: '00000000-0000-4000-8000-0000000000b2',
  padlock: '00000000-0000-4000-8000-0000000000b3',
  firstAid: '00000000-0000-4000-8000-0000000000b4',
};

function lesson(id: string, en: string, icon: LessonIcon, order: number) {
  return {
    id,
    title: { uz: `${en} uz`, ru: `${en} ru`, en },
    icon,
    order,
    questionCount: 4,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

export const catalogBody = (overrides: Record<string, unknown> = {}) => ({
  config: { heartsPerDay: 5, xpFirst: 10, xpPerfect: 5, dailyGoal: 3 },
  tiers: [
    {
      key: '1',
      title: { uz: 'Asoslar', ru: 'Основы', en: 'Basics' },
      colour: '#1CB0A8',
      order: 1,
      lessons: [
        lesson(LESSON_IDS.compass, 'Finding north', 'compass', 1),
        lesson(LESSON_IDS.leaf, 'Leave no trace', 'leaf', 2),
        lesson(LESSON_IDS.padlock, 'Trip plan', 'padlock', 3),
      ],
    },
    {
      key: 'first-aid',
      title: { uz: 'Jarohatlar', ru: 'Травмы', en: 'Injuries' },
      colour: '#D93636',
      order: 2,
      lessons: [lesson(LESSON_IDS.firstAid, 'Blisters', 'first-aid', 1)],
    },
  ],
  progress: null as { completedLessonIds: string[]; doneToday: number } | null,
  ...overrides,
});
