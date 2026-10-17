import { AxiosHeaders } from 'axios';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';

import { collectGuestData, registerGuestItem } from '../../../shared/guest/guestStore';
import { getLocale } from '../../../shared/i18n';
import { storage } from '../../../shared/storage';
import {
  apiError,
  meBody,
  openTab,
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from './harness';

let http: HttpStub;

const ME = '/v1/me';
const REFRESH = '/v1/auth/refresh';
const MERGE = '/v1/me/guest-merge';
const LOG_IN = '/v1/auth/log-in';
const SIGN_OUT = '/v1/auth/sign-out';

const refreshed = {
  status: 200,
  body: { accessToken: 'access_token_2', refreshToken: 'refresh_token_2', expiresIn: 900 },
};

function authorizationOf(call: { headers: unknown } | undefined): string | undefined {
  return AxiosHeaders.from(call?.headers as AxiosHeaders).get('Authorization')?.toString();
}

async function logIn() {
  await fireEvent.press(await screen.findByTestId('profile.guest-login'));
  await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
  await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
  await fireEvent.press(screen.getByTestId('auth.submit'));
  await screen.findByTestId('profile.username');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — guest data merge (AC8)', () => {
  beforeEach(() => {
    http.reply(LOG_IN, { status: 200, body: sessionBody() });
    http.reply(ME, { status: 200, body: meBody() });
    http.reply(SIGN_OUT, { status: 204, body: undefined });
  });

  it('AC8: the app language chosen as a guest is sent once after the first log-in, and logged', async () => {
    http.reply(MERGE, { status: 200, body: { merged: ['locale'], skipped: [] } });
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.language'));
    await fireEvent.press(await screen.findByTestId('profile.language-ru'));
    expect(getLocale()).toBe('ru');

    await fireEvent.press(await screen.findByTestId('profile.guest-login'));
    await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('profile.username');

    expect(http.callsTo(MERGE)).toHaveLength(1);
    expect(JSON.parse(String(http.callsTo(MERGE)[0]?.data))).toEqual({ locale: 'ru' });
    expect(storage.getString('guest.merged')).toBe('1');
    expect(qaEvents()).toContainEqual({ event: 'guest_merged', items: 1 });
  });

  it('AC8: a later log-in on the same device does not send it again', async () => {
    http.reply(MERGE, { status: 200, body: { merged: ['locale'], skipped: [] } });
    await renderApp();
    await openTab('profile');
    await logIn();
    await fireEvent.press(screen.getByTestId('profile.sign-out'));
    await screen.findByTestId('profile.guest');

    await logIn();

    expect(http.callsTo(MERGE)).toHaveLength(1);
  });

  it('AC8: a failed merge keeps the guest data and is retried at the next sign-in', async () => {
    http.reply(MERGE, { networkError: true }, { status: 200, body: { merged: ['locale'], skipped: [] } });
    await renderApp();
    await openTab('profile');
    await logIn();
    expect(storage.getString('guest.merged')).toBeUndefined();
    expect(qaEvents().filter(entry => entry.event === 'guest_merged')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('profile.sign-out'));
    await screen.findByTestId('profile.guest');

    await logIn();

    expect(http.callsTo(MERGE)).toHaveLength(2);
    expect(storage.getString('guest.merged')).toBe('1');
  });

  it('AC8: later features register their own guest items, folded into the same request', () => {
    const unregister = registerGuestItem({
      id: 'onboarding',
      collect: () => ({ onboarding: { experience: 'beginner' } }),
    });

    expect(collectGuestData()).toEqual({ locale: 'en', onboarding: { experience: 'beginner' } });

    unregister();
    expect(collectGuestData()).toEqual({ locale: 'en' });
  });
});

describe('auth — tokens and session end (AC9, AC11)', () => {
  it('AC9: a 401 refreshes once, stores the rotated tokens and retries the request', async () => {
    http.reply(ME, apiError(401, 'UNAUTHORIZED'), { status: 200, body: meBody() });
    http.reply(REFRESH, refreshed);
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    expect(await screen.findByTestId('profile.username')).toHaveTextContent('guest_1');

    expect(http.callsTo(REFRESH)).toHaveLength(1);
    expect(JSON.parse(String(http.callsTo(REFRESH)[0]?.data))).toEqual({ refreshToken: 'refresh_token_1' });
    expect(http.callsTo(ME)).toHaveLength(2);
    expect(authorizationOf(http.callsTo(ME)[0])).toBe('Bearer access_token_1');
    expect(authorizationOf(http.callsTo(ME)[1])).toBe('Bearer access_token_2');
    expect(Keychain.setGenericPassword).toHaveBeenLastCalledWith(
      'session',
      JSON.stringify({ accessToken: 'access_token_2', refreshToken: 'refresh_token_2' }),
      expect.anything(),
    );
  });

  it('AC9: when the refresh token is refused the app returns to guest with a toast', async () => {
    http.reply(ME, apiError(401, 'UNAUTHORIZED'));
    http.reply(REFRESH, apiError(401, 'REFRESH_INVALID'));
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(await screen.findByText("Your session has ended. You're browsing as a guest.")).toBeOnTheScreen();
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    expect(screen.queryByTestId('auth.login')).not.toBeOnTheScreen();
  });

  it('AC9: a reused refresh token ends the session the same way', async () => {
    http.reply(ME, apiError(401, 'UNAUTHORIZED'));
    http.reply(REFRESH, apiError(401, 'REFRESH_REUSED'));
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
  });

  it('AC9: a network failure during refresh keeps the session (no sign-out on a bad connection)', async () => {
    http.reply(ME, apiError(401, 'UNAUTHORIZED'));
    http.reply(REFRESH, { networkError: true });
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    expect(await screen.findByTestId('profile.retry')).toBeOnTheScreen();
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    expect(screen.queryByTestId('profile.guest')).not.toBeOnTheScreen();
  });

  it('AC11: a signed-in user who gets blocked is signed out and sees the blocked message with the reason', async () => {
    http.reply(ME, apiError(403, 'ACCOUNT_BLOCKED', { reasonCode: 'spam' }));
    await startSignedIn();
    await renderApp({ expectTabs: false });

    expect(await screen.findByTestId('auth.blocked')).toHaveTextContent(/Your account is blocked/);
    expect(screen.getByTestId('auth.blocked-reason')).toHaveTextContent('Reason: Spam or advertising');
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    expect(qaEvents()).toContainEqual({ event: 'account_blocked_shown' });

    await fireEvent.press(screen.getByTestId('auth.continue-guest'));
    expect(await screen.findByTestId('empty.coming-soon')).toBeOnTheScreen();
  });

  it('AC11: a block found at refresh time ends the session once, with the blocked message only', async () => {
    http.reply(ME, apiError(401, 'UNAUTHORIZED'));
    http.reply(REFRESH, apiError(403, 'ACCOUNT_BLOCKED', { reasonCode: 'unsafe' }));
    await startSignedIn();
    await renderApp({ expectTabs: false });

    expect(await screen.findByTestId('auth.blocked-reason')).toHaveTextContent(/Unsafe behaviour/);
    expect(screen.queryByText("Your session has ended. You're browsing as a guest.")).not.toBeOnTheScreen();
  });

  it('AC11: the blocked message clears when the user tries again', async () => {
    http.reply(ME, apiError(403, 'ACCOUNT_BLOCKED', { reasonCode: 'other' }));
    http.reply(LOG_IN, apiError(401, 'INVALID_CREDENTIALS'));
    await startSignedIn();
    await renderApp({ expectTabs: false });
    await screen.findByTestId('auth.blocked');

    await fireEvent.changeText(screen.getByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'wrong-pass');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() => expect(screen.queryByTestId('auth.blocked')).not.toBeOnTheScreen());
    expect(await screen.findByTestId('auth.error')).toBeOnTheScreen();
    await act(async () => {});
  });
});
