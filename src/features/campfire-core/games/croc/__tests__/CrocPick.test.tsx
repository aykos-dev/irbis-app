import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { campScheme } from '../../../campTheme';
import type { RosterPlayer } from '../../../protocol/codec';
import { CrocPick } from '../CrocPick';

const roster: RosterPlayer[] = [
  { seatId: 'host', nickname: 'guest_0', avatar: 'fox', host: true, status: 'connected' },
  { seatId: 'p1', nickname: 'guest_1', avatar: 'bear', host: false, status: 'connected' },
  { seatId: 'p2', nickname: 'guest_2', avatar: 'ibex', host: false, status: 'reconnecting' },
];

describe('campfire-crocodile — CrocPick (AC2)', () => {
  it('AC2: the host sees every connected seat (host included) and picks one', async () => {
    const onPick = jest.fn();
    await render(
      <ThemeProvider scheme={campScheme}>
        <CrocPick roster={roster} onPick={onPick} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Who shows next?')).toBeOnTheScreen();
    expect(screen.getByTestId('croc.pick.host')).toHaveTextContent('guest_0');
    expect(screen.queryByTestId('croc.pick.p2')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('croc.pick.p1'));
    expect(onPick).toHaveBeenCalledWith('p1');
  });

  it('AC2: a player phone waits while the host chooses', async () => {
    await render(
      <ThemeProvider scheme={campScheme}>
        <CrocPick roster={roster} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('croc.waiting')).toHaveTextContent('The host is choosing who shows');
    expect(screen.queryByTestId('croc.pick')).not.toBeOnTheScreen();
  });
});
