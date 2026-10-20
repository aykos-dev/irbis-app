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

const l10n = (en: string) => ({ uz: `${en} uz`, ru: `${en} ru`, en });

/** Synthetic `GET /v1/lessons/{id}` body: two questions, the first with a hint. */
export const lessonBody = (id: string = LESSON_IDS.compass) => ({
  id,
  tierKey: '1',
  title: l10n('Finding north'),
  icon: 'compass',
  updatedAt: '2026-10-01T00:00:00.000Z',
  questions: [
    {
      id: '00000000-0000-4000-8000-0000000000c2',
      order: 2,
      prompt: l10n('Which star points north?'),
      hint: null,
      options: [l10n('Sirius'), l10n('Polaris'), l10n('Vega')],
      correctIndex: 1,
      explanation: l10n('Polaris sits above the north pole.'),
      wrongExplanation: null,
      image: null,
    },
    {
      id: '00000000-0000-4000-8000-0000000000c1',
      order: 1,
      prompt: l10n('Where does the sun rise?'),
      hint: l10n('Think of the morning.'),
      options: [l10n('East'), l10n('West'), l10n('North'), l10n('South')],
      correctIndex: 0,
      explanation: l10n('The sun rises in the east.'),
      wrongExplanation: l10n('West is where it sets.'),
      image: null,
    },
  ],
});
