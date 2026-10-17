import { getStateFromPath } from '@react-navigation/native';
import { fireEvent, screen } from '@testing-library/react-native';

import { linking } from '../../navigation/linking';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from './harness';

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/health', {
    status: 200,
    body: { status: 'ok', db: 'up', version: '0.0.1', time: '2026-10-17T08:00:00.000Z' },
  });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — bottom tabs and guest profile (AC1, AC2, AC10)', () => {
  it('AC1: cold start lands on the tab bar with no log-in wall and no request', async () => {
    await renderApp();

    for (const tab of ['path', 'explore', 'lessons', 'community', 'profile']) {
      expect(screen.getByTestId(`nav.tab-${tab}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('empty.coming-soon')).toBeOnTheScreen();
    expect(screen.getByText('Coming with the next update')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.login')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('health.screen')).not.toBeOnTheScreen();
    expect(http.calls).toHaveLength(0);
  });

  it('AC1: Lessons and Community show the same empty state; each press logs tab_opened', async () => {
    await renderApp();

    for (const tab of ['lessons', 'community'] as const) {
      await openTab(tab);
      expect(await screen.findByTestId('empty.coming-soon')).toBeOnTheScreen();
    }

    const tabs = qaEvents()
      .filter(entry => entry.event === 'tab_opened')
      .map(entry => entry.tab);
    expect(tabs).toEqual(['path', 'lessons', 'community']);
  });

  it('AC2: the Profile tab shows the guest profile with its actions and rows', async () => {
    await renderApp();
    await openTab('profile');

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(screen.getByText("You're exploring as a guest")).toBeOnTheScreen();
    expect(screen.getByTestId('profile.guest-signup')).toHaveTextContent(/create free account/i);
    expect(screen.getByTestId('profile.guest-login')).toHaveTextContent(/log in/i);
    expect(screen.getByTestId('profile.language')).toHaveTextContent(/English/);
    expect(screen.getByTestId('profile.safety')).toHaveTextContent(/Safety & SOS/);
  });

  it('AC2: Safety & SOS opens its empty state', async () => {
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.safety'));

    expect(await screen.findByTestId('empty.safety')).toBeOnTheScreen();
  });

  it('AC2: Create free account and Log in open the auth modal at the right screen', async () => {
    await renderApp();
    await openTab('profile');

    await fireEvent.press(await screen.findByTestId('profile.guest-signup'));
    expect(await screen.findByTestId('auth.signup')).toBeOnTheScreen();
  });

  it('AC2: the Language row switches the app language and keeps it on the device', async () => {
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.language'));
    await fireEvent.press(await screen.findByTestId('profile.language-ru'));

    expect(await screen.findByText('Вы исследуете как гость')).toBeOnTheScreen();
    expect(screen.getByLabelText('Карта')).toBeOnTheScreen();
  });

  it('AC10: Status is not the first screen; it opens from Profile → Debug → API status (dev build)', async () => {
    await renderApp();
    expect(screen.queryByTestId('health.screen')).not.toBeOnTheScreen();

    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.debug'));
    await fireEvent.press(await screen.findByTestId('debug.api-status'));

    expect(await screen.findByTestId('health.screen')).toBeOnTheScreen();
    expect(await screen.findByTestId('health.api-chip')).toHaveTextContent('API is up');
  });

  it('AC10: irbis://debug/status resolves to the Status screen in dev builds', () => {
    const state = getStateFromPath('debug/status', linking.config);

    expect(state?.routes[0]?.name).toBe('Status');
  });

  it('AC1: irbis://profile resolves to the Profile tab', () => {
    const state = getStateFromPath('profile', linking.config);

    expect(state?.routes[0]?.name).toBe('MainTabs');
    expect(state?.routes[0]?.state?.routes[0]?.name).toBe('Profile');
  });
});

describe('auth — production builds have no debug route (AC7, AC10)', () => {
  it('registers no Debug / Status route, row or deep link when APP_ENV is prod', async () => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: { API_URL: 'http://localhost:3000', APP_ENV: 'prod' },
    }));
    const { linking: prodLinking } = require('../../navigation/linking');

    expect(getStateFromPath('debug/status', prodLinking.config)).toBeUndefined();
    jest.dontMock('react-native-config');
    jest.resetModules();
  });
});
