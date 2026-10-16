import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../../contexts/theme';
import { StatusChip } from '../StatusChip';

// health/D2: a chip whose label wraps must never grow wider than its container.
describe('StatusChip', () => {
  it('caps its width to the container so a wrapped label cannot overflow it', async () => {
    await render(
      <ThemeProvider>
        <StatusChip testID="chip" variant="go" label="База данных работает" />
      </ThemeProvider>,
    );
    const chip = StyleSheet.flatten(screen.getByTestId('chip').props.style);
    expect(chip.maxWidth).toBe('100%');
  });

  it('lets the label shrink and wrap inside the chip', async () => {
    await render(
      <ThemeProvider>
        <StatusChip testID="chip" variant="go" label="Maʼlumotlar bazasi ishlayapti" />
      </ThemeProvider>,
    );
    const label = StyleSheet.flatten(screen.getByText('Maʼlumotlar bazasi ishlayapti').props.style);
    expect(label.flexShrink).toBe(1);
  });
});
