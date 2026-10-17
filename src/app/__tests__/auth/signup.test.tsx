import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';

import {
  apiError,
  gate,
  goOffline,
  meBody,
  openTab,
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from './harness';

let http: HttpStub;

const SIGN_UP = '/v1/auth/sign-up';
const AVAILABLE = '/v1/auth/username-available';
const MERGE = '/v1/me/guest-merge';

async function openSignUp() {
  await renderApp();
  await openTab('profile');
  await fireEvent.press(await screen.findByTestId('profile.guest-signup'));
  await screen.findByTestId('auth.signup');
}

async function type(testID: string, text: string) {
  await fireEvent.changeText(screen.getByTestId(testID), text);
}

async function fillValid(username = 'guest_1') {
  await type('auth.username', username);
  await type('auth.password', 'Sunrise-42');
  await fireEvent.press(screen.getByTestId('auth.terms'));
}

beforeEach(async () => {
  http = await setUpApp();
  http.handle(AVAILABLE, config => ({
    status: 200,
    body: config.params?.u === 'taken_one' ? { available: false, reason: 'taken' } : { available: true },
  }));
  http.reply(MERGE, { status: 200, body: { merged: ['locale'], skipped: [] } });
  http.reply('/v1/me', { status: 200, body: meBody() });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — sign up (AC3)', () => {
  it('AC3: username rules show under the field after blur', async () => {
    await openSignUp();

    await type('auth.username', 'ab');
    await fireEvent(screen.getByTestId('auth.username'), 'blur');
    expect(await screen.findByText('Use 3–20 characters.')).toBeOnTheScreen();

    await type('auth.username', 'bad name!');
    expect(await screen.findByText('Only letters, numbers, dot and underscore.')).toBeOnTheScreen();

    await type('auth.username', '.dotty');
    expect(await screen.findByText("A dot can't be first or last.")).toBeOnTheScreen();
    expect(http.callsTo(AVAILABLE)).toHaveLength(0);
  });

  it('AC3: availability goes pristine → validating → success, debounced', async () => {
    const reply = gate();
    http.handle(AVAILABLE, () => ({ hold: reply.promise, reply: { status: 200, body: { available: true } } }));
    await openSignUp();
    expect(screen.queryByTestId('auth.username-status')).not.toBeOnTheScreen();

    await type('auth.username', 'aziz_hikes');
    expect(http.callsTo(AVAILABLE)).toHaveLength(0);

    expect(screen.getByTestId('auth.username-status')).toHaveProp('accessibilityValue', {
      text: 'validating',
    });
    await waitFor(() => expect(http.callsTo(AVAILABLE)).toHaveLength(1));
    expect(screen.getByTestId('auth.username-status')).toHaveProp('accessibilityValue', {
      text: 'validating',
    });

    await act(async () => {
      reply.open();
    });
    await waitFor(() =>
      expect(screen.getByTestId('auth.username-status')).toHaveProp('accessibilityValue', {
        text: 'success',
      }),
    );
    expect(screen.getByText('aziz_hikes is free')).toBeOnTheScreen();
    expect(http.callsTo(AVAILABLE)).toHaveLength(1);
    expect(http.callsTo(AVAILABLE)[0]?.params).toEqual({ u: 'aziz_hikes' });
  });

  it('AC3: a taken name shows the error state with the message', async () => {
    await openSignUp();

    await type('auth.username', 'taken_one');

    await waitFor(() =>
      expect(screen.getByTestId('auth.username-status')).toHaveProp('accessibilityValue', {
        text: 'error',
      }),
    );
    expect(screen.getByText('That username is taken.')).toBeOnTheScreen();
  });

  it('AC3: password 6–64, not the username; terms required; phone must be 9 digits', async () => {
    await openSignUp();

    await type('auth.username', 'guest_1');
    await type('auth.password', 'abc');
    await type('auth.phone', '12345');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByText('Use 6–64 characters.')).toBeOnTheScreen();
    expect(screen.getByText('Enter 9 digits after +998.')).toBeOnTheScreen();
    expect(screen.getByText('Please accept the Terms and Privacy Policy.')).toBeOnTheScreen();

    await type('auth.password', 'GUEST_1');
    expect(await screen.findByText("The password can't be your username.")).toBeOnTheScreen();
    expect(http.callsTo(SIGN_UP)).toHaveLength(0);
  });

  it('AC3: success logs in, stores tokens in the Keychain, returns to the profile and logs signed_up', async () => {
    http.reply(SIGN_UP, { status: 201, body: sessionBody() });
    await openSignUp();
    await fillValid();
    await type('auth.phone', '901234567');
    expect(screen.getByTestId('auth.phone').props.value).toBe('90 123 45 67');

    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('profile.username')).toHaveTextContent('guest_1');
    expect(screen.queryByTestId('auth.signup')).not.toBeOnTheScreen();
    const body = http.callsTo(SIGN_UP)[0]?.data;
    expect(JSON.parse(String(body))).toEqual({
      username: 'guest_1',
      password: 'Sunrise-42',
      recoveryPhone: '+998901234567',
      locale: 'en',
      acceptTerms: true,
    });
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
    expect(qaEvents()).toContainEqual({ event: 'signed_up', has_phone: true });
  });

  it('AC3: the recovery phone is optional', async () => {
    http.reply(SIGN_UP, { status: 201, body: sessionBody() });
    await openSignUp();
    await fillValid();
    await fireEvent.press(screen.getByTestId('auth.submit'));

    await screen.findByTestId('profile.username');
    expect(JSON.parse(String(http.callsTo(SIGN_UP)[0]?.data)).recoveryPhone).toBeUndefined();
    expect(qaEvents()).toContainEqual({ event: 'signed_up', has_phone: false });
  });

  it('AC3: server errors land under their field, not in a toast', async () => {
    http.reply(SIGN_UP, apiError(409, 'USERNAME_TAKEN'));
    await openSignUp();
    await fillValid();
    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.username-error')).toHaveTextContent('That username is taken.');
    expect(screen.queryByTestId('app.toast')).not.toBeOnTheScreen();
    expect(screen.getByTestId('auth.signup')).toBeOnTheScreen();

    http.reply(SIGN_UP, apiError(400, 'PASSWORD_WEAK'));
    await fireEvent.press(screen.getByTestId('auth.submit'));
    expect(await screen.findByTestId('auth.password-error')).toHaveTextContent(
      'That password is too easy to guess. Try another one.',
    );
  });

  it('AC3: a pending submit cannot be sent twice', async () => {
    const reply = gate();
    http.reply(SIGN_UP, { hold: reply.promise, reply: { status: 201, body: sessionBody() } });
    await openSignUp();
    await fillValid();

    await fireEvent.press(screen.getByTestId('auth.submit'));
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await act(async () => {
      reply.open();
    });

    await screen.findByTestId('profile.username');
    expect(http.callsTo(SIGN_UP)).toHaveLength(1);
  });

  it('AC3: offline, sign-up is refused with a clear message and sends nothing', async () => {
    await openSignUp();
    await fillValid();
    await goOffline();

    await fireEvent.press(screen.getByTestId('auth.submit'));

    expect(await screen.findByTestId('auth.error')).toHaveTextContent(
      "You're offline. Connect to the internet and try again.",
    );
    expect(http.callsTo(SIGN_UP)).toHaveLength(0);
  });

  it('AC3: the password field has a show / hide toggle', async () => {
    await openSignUp();
    expect(screen.getByTestId('auth.password').props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByTestId('auth.password-toggle'));

    expect(screen.getByTestId('auth.password').props.secureTextEntry).toBe(false);
  });

  it('AC3: fields declare autofill types and the return-key chain', async () => {
    await openSignUp();

    expect(screen.getByTestId('auth.username').props).toMatchObject({
      autoComplete: 'username',
      returnKeyType: 'next',
    });
    expect(screen.getByTestId('auth.password').props).toMatchObject({
      autoComplete: 'new-password',
      textContentType: 'newPassword',
      returnKeyType: 'next',
    });
    expect(screen.getByTestId('auth.phone').props).toMatchObject({
      autoComplete: 'tel-national',
      keyboardType: 'phone-pad',
      returnKeyType: 'done',
    });
  });
});
