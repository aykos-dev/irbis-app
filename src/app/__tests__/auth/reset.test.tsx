import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

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

const FORGOT = '/v1/auth/password/forgot';
const RESET = '/v1/auth/password/reset';

async function openForgot() {
  await renderApp();
  await openTab('profile');
  await fireEvent.press(await screen.findByTestId('profile.guest-login'));
  await fireEvent.press(await screen.findByTestId('auth.forgot-link'));
  await screen.findByTestId('auth.forgot');
}

async function requestCode(username = 'guest_1') {
  await fireEvent.changeText(screen.getByTestId('auth.username'), username);
  await fireEvent.press(screen.getByTestId('auth.submit'));
  await screen.findByTestId('auth.reset');
}

beforeEach(async () => {
  http = await setUpApp();
  http.reply(FORGOT, { status: 202, body: { resendAfterSec: 60 } });
  http.reply('/v1/me/guest-merge', { status: 200, body: { merged: [], skipped: [] } });
  http.reply('/v1/me', { status: 200, body: sessionBody().me });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await tearDownApp(http);
});

describe('auth — forgot and reset password (AC5)', () => {
  it('AC5: A4 shows the support path for accounts without a phone', async () => {
    await openForgot();

    expect(screen.getByTestId('auth.support-note')).toHaveTextContent(/No recovery phone on the account\?/);
  });

  it('AC5: sending a code goes to the code screen and logs password_reset_requested', async () => {
    await openForgot();

    await requestCode();

    expect(JSON.parse(String(http.callsTo(FORGOT)[0]?.data))).toEqual({ username: 'guest_1' });
    expect(screen.getByText('Enter the code')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'password_reset_requested' });
  });

  it('AC5: the answer is the same screen for any username (no account hint)', async () => {
    await openForgot();

    await requestCode('nobody_at_all');

    expect(screen.getByTestId('auth.reset')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.error')).not.toBeOnTheScreen();
  });

  it('AC5: Send again unlocks after 60 s and requests a new code', async () => {
    await openForgot();
    await requestCode();

    expect(screen.getByTestId('auth.resend-countdown')).toHaveTextContent(/Send again in 1:00/);
    expect(screen.queryByTestId('auth.resend')).not.toBeOnTheScreen();

    const start = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(start + 61_000);
    await waitFor(() => expect(screen.getByTestId('auth.resend')).toBeOnTheScreen(), { timeout: 3000 });
    expect(screen.queryByTestId('auth.resend-countdown')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('auth.resend'));

    await waitFor(() => expect(http.callsTo(FORGOT)).toHaveLength(2));
    expect(await screen.findByTestId('auth.resend-countdown')).toBeOnTheScreen();
  });

  it('AC5: the code field takes a 6-digit one-time code', async () => {
    await openForgot();
    await requestCode();

    expect(screen.getByTestId('auth.code').props).toMatchObject({
      keyboardType: 'number-pad',
      textContentType: 'oneTimeCode',
      maxLength: 6,
    });
    await fireEvent.changeText(screen.getByTestId('auth.code'), '48a2 91 77');
    expect(screen.getByTestId('auth.code').props.value).toBe('482917');
  });

  it('AC5: a correct code and a new password log the user in', async () => {
    http.reply(RESET, { status: 200, body: sessionBody() });
    await openForgot();
    await requestCode();

    await fireEvent.changeText(screen.getByTestId('auth.code'), '482917');
    await fireEvent.changeText(screen.getByTestId('auth.new-password'), 'Fresh-pass-7');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('profile.username')).toHaveTextContent('guest_1');
    expect(JSON.parse(String(http.callsTo(RESET)[0]?.data))).toEqual({
      username: 'guest_1',
      code: '482917',
      newPassword: 'Fresh-pass-7',
    });
    expect(qaEvents()).toContainEqual({ event: 'password_reset_done' });
  });

  it.each([
    ['CODE_INVALID', 400, "That code isn't right."],
    ['CODE_EXPIRED', 400, 'The code expired. Send a new one.'],
    ['CODE_ATTEMPTS', 429, 'Too many wrong tries. Send a new code.'],
  ])('AC5: %s shows its message under the code', async (code, status, message) => {
    http.reply(RESET, apiError(status, code));
    await openForgot();
    await requestCode();

    await fireEvent.changeText(screen.getByTestId('auth.code'), '000000');
    await fireEvent.changeText(screen.getByTestId('auth.new-password'), 'Fresh-pass-7');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.code-error')).toHaveTextContent(message);
    expect(screen.getByTestId('auth.reset')).toBeOnTheScreen();
  });

  it('AC5: a weak new password lands under the password field', async () => {
    http.reply(RESET, apiError(400, 'PASSWORD_WEAK'));
    await openForgot();
    await requestCode();

    await fireEvent.changeText(screen.getByTestId('auth.code'), '482917');
    await fireEvent.changeText(screen.getByTestId('auth.new-password'), 'password1');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.new-password-error')).toBeOnTheScreen();
  });

  it('AC5: the code and the new password are validated before sending', async () => {
    await openForgot();
    await requestCode();

    await fireEvent.changeText(screen.getByTestId('auth.code'), '123');
    await fireEvent.changeText(screen.getByTestId('auth.new-password'), 'abc');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByText('Enter all 6 digits.')).toBeOnTheScreen();
    expect(screen.getByText('Use 6–64 characters.')).toBeOnTheScreen();
    await act(async () => {});
    expect(http.callsTo(RESET)).toHaveLength(0);
  });

  it('AC5: a rate-limited code request shows a wait message on A4', async () => {
    http.reply(FORGOT, apiError(429, 'RATE_LIMITED', { retryAfterSec: 20 }));
    await openForgot();

    await fireEvent.changeText(screen.getByTestId('auth.username'), 'guest_1');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.error')).toHaveTextContent(/Too many attempts/);
    expect(screen.queryByTestId('auth.reset')).not.toBeOnTheScreen();
  });
});
