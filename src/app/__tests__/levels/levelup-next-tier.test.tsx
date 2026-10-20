import { act, screen } from '@testing-library/react-native';

import { catalogBody } from '../../../features/lessons/__tests__/harness';
import { levelDefs, myLevelBody } from '../../../features/levels/__tests__/harness';
import { nextTierLine } from '../../../features/levels/screens/LevelUpScreen';
import type { LessonCatalog } from '../../../shared/api/generated/model';
import { meBody, renderApp, setUpApp, startSignedIn, tearDownApp, type HttpStub } from '../auth/harness';

let http: HttpStub;

/** A synthetic pending level-up to `to`. */
const up = (to: number) => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  fromLevel: to - 1,
  toLevel: to,
  maxDifficulty: Math.min(to, 5),
  newPlacesCount: 4,
});

async function showLevelUp(to: number, defs = levelDefs) {
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply('/v1/me/level', { status: 200, body: myLevelBody({ level: to, pendingLevelUps: [up(to)] }) });
  http.reply('/v1/levels', { status: 200, body: { items: defs } });
  await startSignedIn();
  await renderApp();
  await screen.findByTestId('levelup.sequence');
  await act(() => {
    jest.advanceTimersByTime(3000);
  });
  await screen.findByTestId('levelup.continue');
}

beforeEach(async () => {
  http = await setUpApp();
  jest.useFakeTimers();
});
afterEach(async () => {
  jest.useRealTimers();
  await tearDownApp(http);
});

describe('levels — LevelUp next tier line (lessons AC8)', () => {
  it('AC8: names the tier whose lessons count toward the next level', async () => {
    await showLevelUp(3);

    expect(await screen.findByTestId('levelup.nextTier')).toHaveTextContent('Next: Tier 3 lessons count toward Level 4');
  });

  it('AC8: no line when the next level has a count gate, or at Level 7', async () => {
    const countNext = levelDefs.map(def =>
      def.level === 4 ? { ...def, lessons: { kind: 'count' as const, tier: null, required: 6 } } : def,
    );
    await showLevelUp(3, countNext);
    expect(screen.queryByTestId('levelup.nextTier')).toBeNull();

    expect(nextTierLine(7, { kind: 'tier', tier: '3' }, undefined, 'en')).toBeNull();
  });

  it('AC8: uses the cached catalog tier title in the current locale, first-aid wording without it', () => {
    const catalog: LessonCatalog = catalogBody();

    expect(nextTierLine(4, { kind: 'tier', tier: 'first-aid' }, catalog, 'en')).toBe(
      'Next: Injuries lessons count toward Level 5',
    );
    expect(nextTierLine(4, { kind: 'tier', tier: 'first-aid' }, undefined, 'en')).toBe(
      'Next: First aid lessons count toward Level 5',
    );
  });
});
