import { act, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import {
  meBody,
  qaEvents,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { levelColors } from '../../../shared/constants/colors';
import { levelsBody, myLevelBody } from '../../../features/levels/__tests__/harness';

let http: HttpStub;

async function openCompanions() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('Companions');
  });
  await screen.findByTestId('companions.card.7');
}

const opacityOf = (level: number) =>
  StyleSheet.flatten(screen.getByTestId(`companions.art.${level}`).props.style)?.opacity;

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/levels', { status: 200, body: levelsBody });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('levels — Companions (AC6)', () => {
  it('AC6: seven cards; yours has "You" and its colour border; higher levels are silhouettes', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply('/v1/me/level', { status: 200, body: myLevelBody() });
    await startSignedIn();
    await openCompanions();

    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      expect(screen.getByTestId(`companions.card.${level}`)).toBeOnTheScreen();
    }
    const mine = screen.getByTestId('companions.card.3');
    expect(within(mine).getByTestId('companions.you')).toHaveTextContent('You');
    expect(StyleSheet.flatten(mine.props.style).borderColor).toBe(levelColors[3].color);
    expect(screen.getAllByTestId('companions.you')).toHaveLength(1);
    expect(mine).toHaveTextContent(/LEVEL 3.*Pathfinder.*Fox · clever.*1,000 XP · Tier 2 lessons.*Unlocks: difficulty 3/);
    expect(screen.getByTestId('companions.card.1')).toHaveTextContent(/Where every explorer starts\./);
    expect([1, 2, 3].map(opacityOf)).toEqual([undefined, undefined, undefined]);
    expect([4, 5, 6, 7].map(opacityOf)).toEqual([0.35, 0.35, 0.35, 0.35]);
    expect(qaEvents().filter(e => e.event === 'companions_viewed')).toEqual([
      { event: 'companions_viewed', level: 3 },
    ]);
  });

  it('AC6: a guest is level 1 — every other companion is a silhouette', async () => {
    await openCompanions();

    expect(within(screen.getByTestId('companions.card.1')).getByTestId('companions.you')).toBeOnTheScreen();
    expect(opacityOf(1)).toBeUndefined();
    expect([2, 3, 4, 5, 6, 7].map(opacityOf)).toEqual([0.35, 0.35, 0.35, 0.35, 0.35, 0.35]);
    expect(http.callsTo('/v1/me/level')).toHaveLength(0);
    expect(qaEvents().filter(e => e.event === 'companions_viewed')).toEqual([
      { event: 'companions_viewed', level: 1 },
    ]);
  });
});
