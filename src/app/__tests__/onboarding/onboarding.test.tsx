import { getStateFromPath } from '@react-navigation/native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { linking } from '../../navigation/linking';
import {
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { SPLASH_MS } from '../../../features/onboarding/screens/SplashScreen';
import { getLocale, getSavedLocale } from '../../../shared/i18n';
import { storage } from '../../../shared/storage';

let http: HttpStub;

const LOG_IN = '/v1/auth/log-in';

/** First launch: a fresh device that never finished onboarding. */
async function firstLaunch() {
  storage.remove('onboarding.done');
  await renderApp({ expectTabs: false });
  await screen.findByTestId('onboarding.splash');
}

async function passSplash() {
  await act(() => {
    jest.advanceTimersByTime(SPLASH_MS);
  });
  await screen.findByTestId('onboarding.welcome');
}

async function openLanguage() {
  await firstLaunch();
  await passSplash();
  await fireEvent.press(screen.getByTestId('onboarding.get-started'));
  await screen.findByTestId('onboarding.language');
}

function events(name: string) {
  return qaEvents().filter(entry => entry.event === name);
}

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/me/guest-merge', { status: 200, body: { merged: ['locale'], skipped: [] } });
  http.reply('/v1/me', { status: 200, body: sessionBody().me });
  jest.useFakeTimers();
});
afterEach(async () => {
  jest.useRealTimers();
  await tearDownApp(http);
});

describe('onboarding — gate, splash and ending (AC1)', () => {
  it('AC1: first launch as a guest opens Splash, then Welcome after 1500 ms', async () => {
    await firstLaunch();

    expect(screen.queryByTestId('nav.tab-path')).not.toBeOnTheScreen();
    expect(screen.getByText('Explore. Learn. Come back safe.')).toBeOnTheScreen();

    await passSplash();
    expect(screen.queryByTestId('onboarding.splash')).not.toBeOnTheScreen();
    expect(events('onboarding_step').map(entry => entry.step)).toEqual(['splash', 'welcome']);
  });

  it('AC1: signed in at launch skips onboarding and marks it done', async () => {
    storage.remove('onboarding.done');
    await startSignedIn();

    await renderApp();

    expect(screen.queryByTestId('onboarding.splash')).not.toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBe('1');
  });

  it('AC1: the QA links reset onboarding back to Splash and mark it done', () => {
    const parse = linking.getStateFromPath ?? getStateFromPath;

    const reset = parse('debug/onboarding/reset', linking.config);
    expect(reset?.routes[0]?.name).toBe('Onboarding');
    expect(reset?.routes[0]?.state?.routes[0]?.name).toBe('Splash');
    expect(storage.getString('onboarding.done')).toBeUndefined();

    const done = parse('debug/onboarding/done', linking.config);
    expect(done?.routes[0]?.name).toBe('Debug');
    expect(storage.getString('onboarding.done')).toBe('1');
  });
});

describe('onboarding — Meet Irbis (AC2)', () => {
  it('AC2: "I already have an account" opens Log in; closing it returns to Welcome', async () => {
    await firstLaunch();
    await passSplash();

    await fireEvent.press(screen.getByTestId('onboarding.have-account'));
    await screen.findByTestId('auth.login');
    await fireEvent.press(screen.getByTestId('auth.back'));

    expect(await screen.findByTestId('onboarding.welcome')).toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBeUndefined();
  });

  it('AC2: logging in from Welcome ends onboarding with via "login"', async () => {
    http.reply(LOG_IN, { status: 200, body: sessionBody() });
    await firstLaunch();
    await passSplash();

    await fireEvent.press(screen.getByTestId('onboarding.have-account'));
    await screen.findByTestId('auth.login');
    await fireEvent.changeText(screen.getByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding.welcome')).not.toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBe('1');
    expect(events('onboarding_end')).toEqual([{ event: 'onboarding_end', via: 'login', interestsCount: 0 }]);
  });

  it('AC2: the language chip shows the locale and a pick switches the screen live', async () => {
    await firstLaunch();
    await passSplash();
    expect(screen.getByTestId('onboarding.lang-chip')).toHaveTextContent('EN');

    await fireEvent.press(screen.getByTestId('onboarding.lang-chip'));
    await fireEvent.press(await screen.findByTestId('profile.language-ru'));

    expect(await screen.findByText('Начать')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding.lang-chip')).toHaveTextContent('RU');
  });
});

describe('onboarding — Language step (AC3)', () => {
  it('AC3: a row applies and persists the language at once and logs it', async () => {
    await openLanguage();
    expect(screen.getByTestId('onboarding.lang-en')).toBeSelected();
    expect(screen.getByTestId('onboarding.progress')).toHaveTextContent('Step 1 of 4');

    await fireEvent.press(screen.getByTestId('onboarding.lang-uz'));

    expect(getLocale()).toBe('uz');
    expect(getSavedLocale()).toBe('uz');
    expect(screen.getByTestId('onboarding.lang-uz')).toBeSelected();
    expect(screen.getByText('Davom etish')).toBeOnTheScreen();
    expect(events('onboarding_language')).toEqual([{ event: 'onboarding_language', locale: 'uz' }]);
  });

  it('AC3: Continue ends onboarding (via "finish") on the tabs and it never shows again', async () => {
    await openLanguage();

    await fireEvent.press(screen.getByTestId('onboarding.continue'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBe('1');
    expect(events('onboarding_end')).toEqual([{ event: 'onboarding_end', via: 'finish', interestsCount: 0 }]);
  });

  it('AC3: back returns to Welcome; ✕ ends onboarding with via "close"', async () => {
    await openLanguage();

    await fireEvent.press(screen.getByTestId('onboarding.back'));
    await screen.findByTestId('onboarding.welcome');
    await fireEvent.press(screen.getByTestId('onboarding.get-started'));
    await fireEvent.press(await screen.findByTestId('onboarding.close'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBe('1');
    expect(events('onboarding_end')).toEqual([{ event: 'onboarding_end', via: 'close', interestsCount: 0 }]);
  });
});
