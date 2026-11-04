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
  type,
  type HttpStub,
} from './harness';

let http: HttpStub;

const SECURE = '/v1/me/secure';
const SIGN_OUT = '/v1/auth/sign-out';

const demoMe = (overrides: Record<string, unknown> = {}) => meBody({ username: 'explorer_1234', isDemo: true, ...overrides });

async function openDemoProfile() {
  await startSignedIn();
  await renderApp();
  await openTab('profile');
  await screen.findByTestId('profile.account');
}

async function fillSecureForm(username: string) {
  await fireEvent.press(await screen.findByTestId('profile.secure-card'));
  expect(await screen.findByTestId('secure.username')).toHaveDisplayValue('explorer_1234');
  await type('secure.username', username);
  await type('secure.password', 'trail-pass-9');
  await type('secure.confirm', 'trail-pass-9');
  await fireEvent.press(screen.getByTestId('secure.terms'));
  await fireEvent.press(screen.getByTestId('secure.submit'));
}

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('check-in — Secure your account (AC8)', () => {
  it('AC8: a demo profile shows the card; securing it sends the form and clears the card', async () => {
    http.reply('/v1/me', { status: 200, body: demoMe() }, { status: 200, body: demoMe({ username: 'guest_1', isDemo: false }) });
    http.reply(SECURE, { status: 200, body: demoMe({ username: 'guest_1', isDemo: false }) });
    await openDemoProfile();

    expect(screen.getByTestId('profile.username')).toHaveTextContent('explorer_1234');
    await fillSecureForm('guest_1');

    expect(await screen.findByText('Account secured')).toBeOnTheScreen();
    expect(JSON.parse(String(http.callsTo(SECURE)[0]?.data))).toEqual({
      username: 'guest_1',
      password: 'trail-pass-9',
      acceptTerms: true,
    });
    await waitFor(() => expect(screen.queryByTestId('profile.secure-card')).not.toBeOnTheScreen());
    expect(screen.getByTestId('profile.username')).toHaveTextContent('guest_1');
    expect(qaEvents()).toContainEqual({ event: 'account_secured' });
  });

  it('AC8: USERNAME_TAKEN shows under the username field', async () => {
    http.reply('/v1/me', { status: 200, body: demoMe() });
    http.reply(SECURE, apiError(409, 'USERNAME_TAKEN'));
    await openDemoProfile();

    await fillSecureForm('guest_2');

    expect(await screen.findByText('That username is taken.')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.secure')).toBeOnTheScreen();
    expect(qaEvents()).not.toContainEqual({ event: 'account_secured' });
  });

  it('AC8: signing out of a demo account asks first; Sign out then signs out', async () => {
    http.reply('/v1/me', { status: 200, body: demoMe() });
    http.reply(SIGN_OUT, { status: 204, body: undefined });
    await openDemoProfile();

    await fireEvent.press(screen.getByTestId('profile.sign-out'));

    expect(await screen.findByTestId('profile.demo-sign-out')).toHaveTextContent(
      /You'll lose explorer_1234's progress unless you secure it\./,
    );
    expect(http.callsTo(SIGN_OUT)).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('profile.demo-sign-out-confirm'));

    expect(await screen.findByTestId('profile.guest')).toBeOnTheScreen();
    expect(Keychain.resetGenericPassword).toHaveBeenCalled();
  });
});
