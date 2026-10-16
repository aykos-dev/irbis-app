import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../../contexts/theme';
import { ToastProvider } from '../Toast';
import { toast } from '../toastBus';

async function renderProvider() {
  await render(
    <ThemeProvider>
      <ToastProvider>
        <Text>content</Text>
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows queued toasts one at a time and auto-dismisses after the variant duration', async () => {
    await renderProvider();

    await act(() => {
      toast.show({ variant: 'success', message: 'Saved' });
      toast.show({ variant: 'error', message: 'Could not save' });
    });

    expect(screen.getByText('Saved')).toBeOnTheScreen();
    expect(screen.queryByText('Could not save')).not.toBeOnTheScreen();

    await act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.queryByText('Saved')).not.toBeOnTheScreen();
    expect(screen.getByText('Could not save')).toBeOnTheScreen();
  });

  it('dismisses on tap and runs the action', async () => {
    const onRetry = jest.fn();
    await renderProvider();

    await act(() => {
      toast.show({ variant: 'error', message: 'Failed', action: { label: 'Retry', onPress: onRetry } });
    });
    await fireEvent.press(screen.getByTestId('app.toast-action'));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Failed')).not.toBeOnTheScreen();
  });
});
