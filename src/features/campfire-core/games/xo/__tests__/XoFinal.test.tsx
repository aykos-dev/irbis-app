import { render, screen } from '@testing-library/react-native';

import type { ReactElement } from 'react';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { campScheme } from '../../../campTheme';
import type { RosterPlayer, XoPublic } from '../../../protocol/codec';
import { XoFinal } from '../XoFinal';

const roster: RosterPlayer[] = [
  {
    seatId: 'host',
    nickname: 'guest_0',
    avatar: 'fox',
    host: true,
    status: 'connected',
  },
  {
    seatId: 'p1',
    nickname: 'guest_1',
    avatar: 'bear',
    host: false,
    status: 'connected',
  },
];

const ended = { games: 5, draws: 1, score: { host: 1, p1: 3 } };
const info: XoPublic = {
  board: Array(9).fill(null),
  xSeatId: 'host',
  oSeatId: 'p1',
  turn: 'x',
  result: { kind: 'draw' },
  score: ended.score,
  draws: 1,
  gameNo: 5,
  paused: false,
  ended,
};

const themed = (ui: ReactElement) => (
  <ThemeProvider scheme={campScheme}>{ui}</ThemeProvider>
);

describe('campfire-xo — final score lines (AC7)', () => {
  it('AC7: each phone puts its own wins first; the joiner waits for the host', async () => {
    await render(
      themed(
        <XoFinal ended={ended} info={info} selfSeatId="p1" roster={roster} />,
      ),
    );
    expect(screen.getByTestId('xo.final.line')).toHaveTextContent(
      'You win the series 3–1',
    );
    expect(screen.getByTestId('xo.final.stats')).toHaveTextContent(
      'Draws 1 · Games 5',
    );
    expect(screen.getByTestId('xo.wait-host')).toHaveTextContent(
      'Waiting for the host',
    );
    expect(screen.queryByTestId('xo.play-again')).not.toBeOnTheScreen();

    await screen.rerender(
      themed(
        <XoFinal
          ended={ended}
          info={info}
          selfSeatId="host"
          roster={roster}
          host={{ onPlayAgain: jest.fn(), onLobby: jest.fn() }}
        />,
      ),
    );
    expect(screen.getByTestId('xo.final.line')).toHaveTextContent(
      'guest_1 wins the series 3–1',
    );
    expect(screen.getByTestId('xo.play-again')).toBeOnTheScreen();
    expect(screen.getByTestId('xo.lobby')).toBeOnTheScreen();
  });
});
