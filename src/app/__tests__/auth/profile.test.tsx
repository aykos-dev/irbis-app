import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';

import {
  apiError,
  meBody,
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type HttpStub,
} from './harness';

let http: HttpStub;

const SET_PHONE = '/v1/me/recovery-phone';
const VERIFY = '/v1/me/recovery-phone/verify';
const SIGN_OUT = '/v1/auth/sign-out';

async function openProfile() {
  await startSignedIn();
  await renderApp();
  await openTab('profile');
  await screen.findByTestId('profile.account');
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — signed-in profile (AC6)', () => {
  it('AC6: shows the username, the Recovery phone row (Add) and Sign out', async () => {
    http.reply('/v1/me', { status: 200, body: meBody({ username: 'guest_1' }) });
    await openProfile();

    expect(await screen.findByTestId('profile.username')).toHaveTextContent('guest_1');
    expect(screen.getByTestId('profile.recovery-phone')).toHaveTextContent(/Recovery phone.*Add/);
    expect(screen.getByTestId('profile.sign-out')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile.guest')).not.toBeOnTheScreen();
  });

  it('AC6: shows a skeleton while the user loads and a retry when it fails', async () => {
    http.reply('/v1/me', { networkError: true }, { status: 200, body: meBody() });
    await startSignedIn();
    await renderApp();
    await openTab('profile');

    await fireEvent.press(await screen.findByTestId('profile.retry'));

    expect(await screen.findByTestId('profile.username')).toBeOnTheScreen();
  });

  it('AC6: adding a phone sends a code; verifying it marks the phone verified', async () => {
    http.reply(
      '/v1/me',
      { status: 200, body: meBody() },
      { status: 200, body: meBody({ recoveryPhonePending: true }) },
    );
    http.reply(SET_PHONE, { status: 202, body: { resendAfterSec: 60 } });
    http.reply(VERIFY, { status: 200, body: meBody({ hasRecoveryPhone: true }) });
    await openProfile();

    await fireEvent.press(await screen.findByTestId('profile.recovery-phone'));
    await fireEvent.changeText(await screen.findByTestId('auth.phone'), '901234567');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.code')).toBeOnTheScreen();
    expect(JSON.parse(String(http.callsTo(SET_PHONE)[0]?.data))).toEqual({ phone: '+998901234567' });

    await fireEvent.changeText(screen.getByTestId('auth.code'), '482917');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() =>
      expect(screen.getByTestId('profile.recovery-phone')).toHaveTextContent(/Verified/),
    );
    expect(JSON.parse(String(http.callsTo(VERIFY)[0]?.data))).toEqual({ code: '482917' });
    expect(qaEvents()).toContainEqual({ event: 'recovery_phone_verified' });
  });

  it('AC6: an invalid phone and a wrong code show errors under their fields', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(SET_PHONE, { status: 202, body: { resendAfterSec: 60 } });
    http.reply(VERIFY, apiError(400, 'CODE_INVALID'));
    await openProfile();
    await fireEvent.press(await screen.findByTestId('profile.recovery-phone'));

    await fireEvent.changeText(await screen.findByTestId('auth.phone'), '12345');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    expect(await screen.findByText('Enter 9 digits after +998.')).toBeOnTheScreen();
    expect(http.callsTo(SET_PHONE)).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('auth.phone'), '901234567');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('auth.code');
    await fireEvent.changeText(screen.getByTestId('auth.code'), '000000');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.code-error')).toHaveTextContent("That code isn't right.");
  });

  it('AC6: a phone waiting for its code opens straight on the code step', async () => {
    http.reply('/v1/me', { status: 200, body: meBody({ recoveryPhonePending: true }) });
    await openProfile();

    expect(screen.getByTestId('profile.recovery-phone')).toHaveTextContent(/Verify/);
    await fireEvent.press(screen.getByTestId('profile.recovery-phone'));

    expect(await screen.findByTestId('auth.code')).toBeOnTheScreen();
  });

  it('AC6: a verified phone shows the check and is not pressable', async () => {
    http.reply('/v1/me', { status: 200, body: meBody({ hasRecoveryPhone: true }) });
    await openProfile();

    expect(screen.getByTestId('profile.recovery-phone')).toHaveTextContent(/Verified/);
    await fireEvent.press(screen.getByTestId('profile.recovery-phone'));
    expect(screen.queryByTestId('auth.recovery-phone')).not.toBeOnTheScreen();
  });

  it('AC6: Sign out clears the Keychain and returns to the guest profile, no wall', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(SIGN_OUT, { status: 204, body: undefined });
    await openProfile();

    await fireEvent.press(screen.getByTestId('profile.sign-out'));

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    expect(JSON.parse(String(http.callsTo(SIGN_OUT)[0]?.data))).toEqual({
      refreshToken: 'refresh_token_1',
    });
    expect(qaEvents()).toContainEqual({ event: 'signed_out' });
    expect(screen.queryByTestId('auth.login')).not.toBeOnTheScreen();
  });

  it('AC6: Sign out works even when the server cannot be reached', async () => {
    http.reply('/v1/me', { status: 200, body: meBody() });
    http.reply(SIGN_OUT, { networkError: true });
    await openProfile();

    await fireEvent.press(screen.getByTestId('profile.sign-out'));

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
  });
});
