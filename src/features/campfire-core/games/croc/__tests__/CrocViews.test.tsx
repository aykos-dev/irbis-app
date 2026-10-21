import { act, fireEvent, render, screen } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { campScheme, crocColors } from '../../../campTheme';
import { CrocSummary } from '../CrocSummary';
import { CrocTimer } from '../CrocTimer';

const haptic = jest.mocked(HapticFeedback.trigger);
const totals = { guessed: 4, skipped: 2, turns: 6 };

const inCamp = (node: React.ReactElement) => render(<ThemeProvider scheme={campScheme}>{node}</ThemeProvider>);

const colorOf = (testID: string): unknown => {
  const style: unknown = screen.getByTestId(testID).props.style;
  const flat = (Array.isArray(style) ? style.flat(3) : [style]) as ({ color?: string } | undefined)[];
  return flat.reduce<string | undefined>((color, item) => item?.color ?? color, undefined);
};

describe('campfire-crocodile — CrocTimer (AC4)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    haptic.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('AC4: counts down locally from the time left, warning colour under 10 s, light haptic on the last 5', async () => {
    await inCamp(<CrocTimer remainingMs={12000} durationSec={60} />);
    expect(screen.getByTestId('croc.timer.seconds')).toHaveTextContent('12');
    expect(colorOf('croc.timer.seconds')).not.toBe(crocColors.warning);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByTestId('croc.timer.seconds')).toHaveTextContent('10');
    expect(colorOf('croc.timer.seconds')).toBe(crocColors.warning);
    expect(haptic).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(screen.getByTestId('croc.timer.seconds')).toHaveTextContent('0');
    expect(haptic.mock.calls.filter(([type]) => type === 'impactLight')).toHaveLength(5);
  });
});

describe('campfire-crocodile — CrocSummary (AC7)', () => {
  it('AC7: the host gets Play again and Lobby with the totals', async () => {
    const host = { onPlayAgain: jest.fn(), onLobby: jest.fn() };
    await inCamp(<CrocSummary totals={totals} host={host} />);
    expect(screen.getByText('Game over')).toBeOnTheScreen();
    expect(screen.getByTestId('croc.summary.totals')).toHaveTextContent('Words guessed 4 · Skipped 2 · Turns 6');
    await fireEvent.press(screen.getByTestId('croc.play-again'));
    await fireEvent.press(screen.getByTestId('croc.lobby'));
    expect(host.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(host.onLobby).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('croc.wait-host')).not.toBeOnTheScreen();
  });

  it('AC7: everyone else waits for the host', async () => {
    await inCamp(<CrocSummary totals={totals} />);
    expect(screen.getByTestId('croc.wait-host')).toHaveTextContent('Waiting for the host');
    expect(screen.queryByTestId('croc.play-again')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('croc.lobby')).not.toBeOnTheScreen();
  });
});
