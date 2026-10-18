import { i18n } from '../../../shared/i18n';
import { formatRequirement } from '../formatRequirement';
import { levelDefs } from './harness';

const at = (level: number) => {
  const found = levelDefs.find(def => def.level === level);
  if (!found) {
    throw new Error(`no level ${level}`);
  }
  return found;
};

let previous: string;
beforeEach(() => {
  previous = i18n.locale;
});
afterEach(() => {
  i18n.locale = previous;
});

describe('formatRequirement (AC6)', () => {
  it('AC6: level 1 is "Where every explorer starts."; count, tier, first-aid and all kinds in en', () => {
    i18n.locale = 'en';
    expect(formatRequirement(at(1), 'en')).toBe('Where every explorer starts.');
    expect(formatRequirement(at(2), 'en')).toBe('300 XP · 2 safety lessons · 2 verified check-ins');
    expect(formatRequirement(at(3), 'en')).toBe('1,000 XP · Tier 2 lessons · 5 check-ins at difficulty 2+');
    expect(formatRequirement(at(5), 'en')).toBe('5,000 XP · First-aid tier · 12 check-ins at difficulty 3+');
    expect(formatRequirement(at(7), 'en')).toBe(
      '15,000 XP · all tiers · 25 check-ins at difficulty 5+ · 3 verified spots',
    );
  });

  it('AC6: ru uses one / few / many plurals and the locale thousands separator', () => {
    i18n.locale = 'ru';
    const nbsp = new Intl.NumberFormat('ru').format(1000).charAt(1);
    expect(formatRequirement(at(2), 'ru')).toBe(
      '300 XP · 2 урока безопасности · 2 подтверждённые отметки',
    );
    expect(formatRequirement({ ...at(2), lessons: { kind: 'count', tier: null, required: 1 }, checkIns: { required: 21, minDifficulty: 1 } }, 'ru')).toBe(
      '300 XP · 1 урок безопасности · 21 подтверждённая отметка',
    );
    expect(formatRequirement(at(7), 'ru')).toBe(
      `15${nbsp}000 XP · все ступени · 25 отметок на сложности 5+ · 3 подтверждённых места`,
    );
  });

  it('AC6: uz copy', () => {
    i18n.locale = 'uz';
    expect(formatRequirement(at(4), 'uz')).toBe(
      `${new Intl.NumberFormat('uz').format(2500)} XP · 3-bosqich darslari · 3+ qiyinlikda 8 ta belgi`,
    );
  });
});
