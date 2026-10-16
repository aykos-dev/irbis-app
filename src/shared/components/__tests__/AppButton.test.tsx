import { fireEvent, render, screen } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';

import { ThemeProvider } from '../../contexts/theme';
import { AppButton } from '../AppButton';

describe('AppButton', () => {
  it('calls onPress once and fires a light impact haptic', async () => {
    const onPress = jest.fn();
    await render(
      <ThemeProvider>
        <AppButton testID="test.button" label="Retry" onPress={onPress} />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('test.button'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(HapticFeedback.trigger).toHaveBeenCalledWith('impactLight', {
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <ThemeProvider>
        <AppButton testID="test.button" label="Retry" onPress={onPress} disabled />
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByTestId('test.button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
