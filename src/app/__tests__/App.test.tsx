import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import { stubHttp, type HttpStub } from '../../../jest/httpStub';
import { createQueryClient } from '../../shared/api/query';
import { navigationRef } from '../navigation/navigationRef';
import { AppNavigation } from '../App';
import { Providers } from '../providers';

/** Same tree as <App />, with a client that schedules no GC timers after unmount. */
async function renderApp() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { gcTime: Infinity } });
  await render(
    <Providers queryClient={queryClient}>
      <AppNavigation />
    </Providers>,
  );
}

let http: HttpStub;

describe('App shell', () => {
  beforeEach(() => {
    http = stubHttp();
    http.reply('/health', {
      status: 200,
      body: { status: 'ok', db: 'up', version: '0.0.1', time: '2026-10-17T08:00:00.000Z' },
    });
  });
  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
    http.restore();
  });

  it('renders the providers with the tab bar as the initial route and Status reachable in dev builds (auth AC1, AC10)', async () => {
    await renderApp();

    expect(screen.getByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(screen.queryByTestId('health.screen')).not.toBeOnTheScreen();

    await act(() => {
      navigationRef.navigate('Status');
    });

    expect(screen.getByTestId('health.screen')).toBeOnTheScreen();
    expect(screen.getByText('Status')).toBeOnTheScreen();
    expect(await screen.findByTestId('health.api-chip')).toBeOnTheScreen();
    expect(screen.queryByTestId('app.offline-banner')).not.toBeOnTheScreen();
  });

  it('shows the persistent offline banner when the network drops', async () => {
    await renderApp();
    await act(() => {
      navigationRef.navigate('Status');
    });
    await screen.findByTestId('health.api-chip');

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
  });
});
