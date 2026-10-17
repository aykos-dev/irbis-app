import { fireEvent, screen } from '@testing-library/react-native';

import {
  apiError,
  openTab,
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from './harness';

let http: HttpStub;

const LOG_IN = '/v1/auth/log-in';
const MERGE = '/v1/me/guest-merge';

async function openLogIn() {
  await renderApp();
  await openTab('profile');
  await fireEvent.press(await screen.findByTestId('profile.guest-login'));
  await screen.findByTestId('auth.login');
}

async function submit(username = 'guest_1', password = 'Sunrise-42') {
  await fireEvent.changeText(screen.getByTestId('auth.username'), username);
  await fireEvent.changeText(screen.getByTestId('auth.password'), password);
  await fireEvent.press(screen.getByTestId('auth.submit'));
}

beforeEach(async () => {
  http = await setUpApp();
  http.reply(MERGE, { status: 200, body: { merged: ['locale'], skipped: [] } });
  http.reply('/v1/me', { status: 200, body: sessionBody().me });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — log in (AC4, AC11)', () => {
  it('AC4: logs in with username + password, shows the signed-in profile and logs logged_in', async () => {
    http.reply(LOG_IN, { status: 200, body: sessionBody() });
    await openLogIn();

    await submit();

    expect(await screen.findByTestId('profile.username')).toHaveTextContent('guest_1');
    expect(JSON.parse(String(http.callsTo(LOG_IN)[0]?.data))).toEqual({
      username: 'guest_1',
      password: 'Sunrise-42',
    });
    expect(qaEvents()).toContainEqual({ event: 'logged_in' });
  });

  it('AC4: a wrong username or password shows one generic message', async () => {
    http.reply(LOG_IN, apiError(401, 'INVALID_CREDENTIALS'));
    await openLogIn();

    await submit('nobody_1', 'wrong-pass');

    expect(await screen.findByTestId('auth.error')).toHaveTextContent('Username or password is wrong');
    expect(screen.queryByTestId('app.toast')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'log_in_failed', code: 'INVALID_CREDENTIALS' });
  });

  it('AC4: after the lock the message says how long (minutes, rounded up)', async () => {
    http.reply(LOG_IN, apiError(423, 'ACCOUNT_LOCKED', { retryAfterSec: 840 }));
    await openLogIn();

    await submit();

    expect(await screen.findByTestId('auth.error')).toHaveTextContent(
      'Too many tries. Try again in 14 minutes.',
    );
    expect(qaEvents()).toContainEqual({ event: 'log_in_failed', code: 'ACCOUNT_LOCKED' });
  });

  it('AC4: the lock message uses the singular for one minute', async () => {
    http.reply(LOG_IN, apiError(423, 'ACCOUNT_LOCKED', { retryAfterSec: 30 }));
    await openLogIn();

    await submit();

    expect(await screen.findByTestId('auth.error')).toHaveTextContent(/Try again in 1 minute\./);
  });

  it('AC4: a per-IP rate limit shows a wait message', async () => {
    http.reply(LOG_IN, apiError(429, 'RATE_LIMITED', { retryAfterSec: 30 }));
    await openLogIn();

    await submit();

    expect(await screen.findByTestId('auth.error')).toHaveTextContent(
      'Too many attempts. Wait a moment and try again.',
    );
  });

  it('AC4: required fields show errors without a request', async () => {
    await openLogIn();

    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(http.callsTo(LOG_IN)).toHaveLength(0);
  });

  it('AC4: Continue as guest closes the screen back to the profile', async () => {
    await openLogIn();

    await fireEvent.press(screen.getByTestId('auth.continue-guest'));

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.login')).not.toBeOnTheScreen();
  });

  it('AC4: Forgot password opens the forgot screen', async () => {
    await openLogIn();

    await fireEvent.press(screen.getByTestId('auth.forgot-link'));

    expect(await screen.findByTestId('auth.forgot')).toBeOnTheScreen();
  });

  it('AC4: username and password fields use login autofill types and the return-key chain', async () => {
    await openLogIn();

    expect(screen.getByTestId('auth.username').props).toMatchObject({
      autoComplete: 'username',
      textContentType: 'username',
      returnKeyType: 'next',
    });
    expect(screen.getByTestId('auth.password').props).toMatchObject({
      autoComplete: 'current-password',
      textContentType: 'password',
      returnKeyType: 'done',
    });
  });

  it('AC11: a blocked user sees "Your account is blocked" with the reason category', async () => {
    http.reply(LOG_IN, apiError(403, 'ACCOUNT_BLOCKED', { reasonCode: 'harassment' }));
    await openLogIn();

    await submit();

    expect(await screen.findByTestId('auth.blocked')).toHaveTextContent(/Your account is blocked/);
    expect(screen.getByTestId('auth.blocked-reason')).toHaveTextContent('Reason: Harassment or hate');
    expect(screen.queryByTestId('auth.error')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'account_blocked_shown' });
    expect(qaEvents()).toContainEqual({ event: 'log_in_failed', code: 'ACCOUNT_BLOCKED' });
  });
});
