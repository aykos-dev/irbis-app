import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';

import { AppNavigation } from '../../App';
import { navigationRef } from '../../navigation/navigationRef';
import { Providers } from '../../providers';
import { gate, stubHttp, type HttpStub, type StubReply } from '../../../../jest/httpStub';
import { createQueryClient } from '../../../shared/api/query';
import { tokenManager } from '../../../shared/api/tokenManager';
import { authGate } from '../../../shared/auth/gateBus';
import { i18n } from '../../../shared/i18n';
import { storage } from '../../../shared/storage';

export { gate };
export type { HttpStub, StubReply };

/** Synthetic account data only (guest_1, never a real person). */
export const meBody = (overrides: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'guest_1',
  locale: 'en',
  role: 'user',
  hasRecoveryPhone: false,
  recoveryPhonePending: false,
  createdAt: '2026-10-17T08:00:00.000Z',
  ...overrides,
});

export const sessionBody = (overrides: Record<string, unknown> = {}) => ({
  accessToken: 'access_token_1',
  refreshToken: 'refresh_token_1',
  expiresIn: 900,
  me: meBody(overrides),
});

export const apiError = (status: number, code: string, extra: Record<string, unknown> = {}) => ({
  status,
  body: { statusCode: status, code, message: 'server message', requestId: 'req_1', ...extra },
});

let log: jest.SpyInstance | null = null;

/** Stubs the network, empties device state and listens for QA events. Call in beforeEach. */
export async function setUpApp(): Promise<HttpStub> {
  const http = stubHttp();
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await tokenManager.clear();
  storage.clearAll();
  i18n.locale = 'en';
  authGate.cancel();
  jest.mocked(Keychain.setGenericPassword).mockClear();
  jest.mocked(Keychain.resetGenericPassword).mockClear();
  return http;
}

export async function tearDownApp(http: HttpStub): Promise<void> {
  await act(() => {
    onlineManager.setOnline(true);
  });
  http.restore();
  log?.mockRestore();
  log = null;
}

export function qaEvents(): { event: string; [key: string]: unknown }[] {
  return (log?.mock.calls ?? [])
    .map(call => String(call[0]))
    .filter(line => line.startsWith('IRBIS_QA '))
    .map(line => JSON.parse(line.slice('IRBIS_QA '.length)));
}

export function qaEventNames(): string[] {
  return qaEvents().map(entry => entry.event);
}

/** Simulates an already signed-in device (tokens in the Keychain double). */
export async function startSignedIn(): Promise<void> {
  await tokenManager.setTokens({ accessToken: 'access_token_1', refreshToken: 'refresh_token_1' });
}

/** `expectTabs: false` when the app is expected to open straight on an auth screen. */
export async function renderApp({ expectTabs = true }: { expectTabs?: boolean } = {}): Promise<void> {
  const queryClient = createQueryClient();
  // No GC timers (queries or mutations) that would outlive the test and keep the worker alive.
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  });
  await render(
    <Providers queryClient={queryClient}>
      <AppNavigation />
    </Providers>,
  );
  if (expectTabs) {
    await screen.findByTestId('nav.tab-profile');
  }
}

export async function openTab(tab: 'path' | 'explore' | 'lessons' | 'community' | 'profile') {
  await fireEvent.press(screen.getByTestId(`nav.tab-${tab}`));
}

export async function type(testID: string, text: string) {
  await fireEvent.changeText(screen.getByTestId(testID), text);
}

export async function goOffline() {
  await act(() => {
    onlineManager.setOnline(false);
  });
}

export function navigate(...args: Parameters<typeof navigationRef.navigate>) {
  act(() => {
    navigationRef.navigate(...args);
  });
}
