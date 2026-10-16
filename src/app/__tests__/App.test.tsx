import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import { App } from '../App';

describe('App shell', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('renders the providers and the Status screen', async () => {
    await render(<App />);

    expect(screen.getByTestId('health.screen')).toBeOnTheScreen();
    expect(screen.getByText('Status')).toBeOnTheScreen();
    expect(screen.getByTestId('health.environment')).toHaveTextContent('Environment: dev');
    expect(screen.queryByTestId('app.offline-banner')).not.toBeOnTheScreen();
  });

  it('shows the persistent offline banner when the network drops', async () => {
    await render(<App />);

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
  });
});
