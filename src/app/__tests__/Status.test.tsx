import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { gate, stubHttp, type HttpStub } from '../../../jest/httpStub';
import { createQueryClient } from '../../shared/api/query';
import { navigationRef } from '../navigation/navigationRef';
import { AppNavigation } from '../App';
import { Providers } from '../providers';

const ok = {
  status: 200,
  body: { status: 'ok', db: 'up', version: '0.0.1', time: '2026-10-17T08:00:00.000Z' },
};
const degraded = {
  status: 503,
  body: { status: 'degraded', db: 'down', version: '0.0.1', time: '2026-10-17T08:00:00.000Z' },
};

let http: HttpStub;
let log: jest.SpyInstance;

async function renderApp() {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  await render(
    <Providers queryClient={queryClient}>
      <AppNavigation />
    </Providers>,
  );
  // AC10 (auth): Status is no longer the initial route; dev builds reach it via Debug / deep link.
  await act(() => {
    navigationRef.navigate('Status');
  });
}

function qaEvents(): string[] {
  return log.mock.calls
    .map(call => String(call[0]))
    // The tab bar (auth) logs tab_opened too; this suite asserts the health events only.
    .filter(line => line.startsWith('IRBIS_QA {"event":"health_'));
}

describe('Status screen (features/health.md)', () => {
  beforeEach(() => {
    http = stubHttp();
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await act(() => {
      onlineManager.setOnline(true);
    });
    http.restore();
    log.mockRestore();
  });

  it('AC3: shows a skeleton, then API up · Database up · version with Go chips (AC6 via GET /health)', async () => {
    const response = gate();
    http.reply('/health', { hold: response.promise, reply: ok });
    await renderApp();

    expect(screen.getByTestId('health.skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('health.api-chip')).not.toBeOnTheScreen();

    await act(() => {
      response.open();
    });

    expect(await screen.findByTestId('health.api-chip')).toHaveTextContent('API is up');
    expect(screen.getByTestId('health.db-chip')).toHaveTextContent('Database is up');
    expect(screen.getByTestId('health.version')).toHaveTextContent('v0.0.1');
    expect(screen.getByTestId('health.status-card')).toBeOnTheScreen();
    expect(screen.queryByTestId('health.skeleton')).not.toBeOnTheScreen();
    expect(http.calls[0]?.method).toBe('get');
  });

  it('AC7: logs health_checked { status, db } when the result is shown', async () => {
    http.reply('/health', ok);
    await renderApp();
    await screen.findByTestId('health.api-chip');

    expect(qaEvents()).toEqual(['IRBIS_QA {"event":"health_checked","status":"ok","db":"up"}']);
  });

  it('AC3: a 503 degraded body is a result, not an error — DB chip Not-now, API chip stays up (Q4, health/D1)', async () => {
    http.reply('/health', degraded);
    await renderApp();

    expect(await screen.findByTestId('health.db-chip')).toHaveTextContent('Database is down');
    expect(screen.getByTestId('health.api-chip')).toHaveTextContent('API is up');
    expect(screen.queryByTestId('health.retry')).not.toBeOnTheScreen();
    expect(qaEvents()).toEqual([
      'IRBIS_QA {"event":"health_checked","status":"degraded","db":"down"}',
    ]);
  });

  it('AC3: API unreachable shows an error state; Retry refetches', async () => {
    http.reply('/health', { networkError: true }, ok);
    await renderApp();

    const retry = await screen.findByTestId('health.retry');
    expect(screen.getByText("Can't reach Irbis. Check your connection and try again.")).toBeOnTheScreen();
    expect(qaEvents()).toEqual([]);

    await fireEvent.press(retry);

    expect(await screen.findByTestId('health.api-chip')).toHaveTextContent('API is up');
    expect(http.callsTo('/health')).toHaveLength(2);
  });

  it('rejects a body that does not match the generated schema', async () => {
    http.reply('/health', { status: 200, body: { status: 'fine' } });
    await renderApp();

    expect(await screen.findByTestId('health.retry')).toBeOnTheScreen();
    expect(screen.queryByTestId('health.api-chip')).not.toBeOnTheScreen();
  });

  it('AC3: offline shows the persistent banner and keeps the cached result, marked stale', async () => {
    http.reply('/health', ok);
    await renderApp();
    await screen.findByTestId('health.api-chip');

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(screen.getByTestId('app.offline-banner')).toBeOnTheScreen();
    expect(screen.getByTestId('health.api-chip')).toHaveTextContent('API is up');
    expect(screen.getByTestId('health.stale')).toBeOnTheScreen();
  });

  it('AC3: pull to refresh refetches', async () => {
    http.reply('/health', ok, degraded);
    await renderApp();
    await screen.findByTestId('health.api-chip');

    const scroll = screen.getByTestId('health.screen-scroll');
    await act(() => scroll.props.refreshControl.props.onRefresh());

    expect(await screen.findByText('Database is down')).toBeOnTheScreen();
    expect(http.callsTo('/health')).toHaveLength(2);
  });
});
