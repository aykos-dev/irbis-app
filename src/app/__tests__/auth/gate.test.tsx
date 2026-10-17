import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { authGate } from '../../../shared/auth/gateBus';
import {
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

async function openDebugGate() {
  await openTab('profile');
  await fireEvent.press(await screen.findByTestId('profile.debug'));
  await fireEvent.press(await screen.findByTestId('debug.open-gate'));
}

async function signUpFromGate() {
  await fireEvent.press(await screen.findByTestId('auth.gate-signup'));
  await screen.findByTestId('auth.signup');
  await fireEvent.changeText(screen.getByTestId('auth.username'), 'guest_1');
  await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
  await fireEvent.press(screen.getByTestId('auth.terms'));
  await fireEvent.press(screen.getByTestId('auth.submit'));
}

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/auth/sign-up', { status: 201, body: sessionBody() });
  http.reply('/v1/auth/log-in', { status: 200, body: sessionBody() });
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply('/v1/me/guest-merge', { status: 200, body: { merged: [], skipped: [] } });
  http.reply('/v1/auth/username-available', { status: 200, body: { available: true } });
});
afterEach(async () => {
  await tearDownApp(http);
});

describe('auth — log-in prompt and useRequireAccount (AC7)', () => {
  it('AC7: a guest sees the prompt with its actions and the reason copy; auth_gate_shown is logged', async () => {
    await renderApp();

    await openDebugGate();

    expect(await screen.findByTestId('auth.gate')).toBeOnTheScreen();
    expect(screen.getByText('Keep your progress')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.gate-signup')).toHaveTextContent(/create free account/i);
    expect(screen.getByTestId('auth.gate-login')).toHaveTextContent(/i have an account/i);
    expect(screen.getByTestId('auth.gate-not-now')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'auth_gate_shown', reason: 'progress' });
  });

  it('AC7: Not now closes the prompt, runs nothing and logs auth_gate_dismissed', async () => {
    await renderApp();
    await openDebugGate();

    await fireEvent.press(await screen.findByTestId('auth.gate-not-now'));

    await waitFor(() => expect(screen.queryByTestId('auth.gate')).not.toBeOnTheScreen());
    expect(screen.getByTestId('debug.gate-ran')).toHaveTextContent(/ran 0 time/);
    expect(screen.getByTestId('debug.screen')).toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'auth_gate_dismissed', reason: 'progress' });
    expect(authGate.hasPending()).toBe(false);
  });

  it('AC7: after sign-up the gated action continues once and the user is back where they were', async () => {
    await renderApp();
    await openDebugGate();

    await signUpFromGate();

    await waitFor(() => expect(screen.getByTestId('debug.gate-ran')).toHaveTextContent(/ran 1 time/));
    expect(screen.getByTestId('debug.screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.signup')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('auth.gate')).not.toBeOnTheScreen();
    expect(authGate.hasPending()).toBe(false);
  });

  it('AC7: "I have an account" opens log-in, and a log-in continues the action', async () => {
    await renderApp();
    await openDebugGate();

    await fireEvent.press(await screen.findByTestId('auth.gate-login'));
    await screen.findByTestId('auth.login');
    await fireEvent.changeText(screen.getByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));

    await waitFor(() => expect(screen.getByTestId('debug.gate-ran')).toHaveTextContent(/ran 1 time/));
  });

  it('AC7: leaving the auth screens without signing in drops the action — nothing is lost', async () => {
    await renderApp();
    await openDebugGate();
    await fireEvent.press(await screen.findByTestId('auth.gate-signup'));
    await screen.findByTestId('auth.signup');

    await fireEvent.press(screen.getByTestId('auth.back'));
    await waitFor(() => expect(screen.queryByTestId('auth.signup')).not.toBeOnTheScreen());

    expect(authGate.hasPending()).toBe(false);
    expect(screen.getByTestId('debug.gate-ran')).toHaveTextContent(/ran 0 time/);
    expect(screen.getByTestId('debug.screen')).toBeOnTheScreen();
  });

  it('AC7: a signed-in user runs the action immediately, with no prompt', async () => {
    await startSignedIn();
    await renderApp();

    await openDebugGate();

    await waitFor(() => expect(screen.getByTestId('debug.gate-ran')).toHaveTextContent(/ran 1 time/));
    expect(screen.queryByTestId('auth.gate')).not.toBeOnTheScreen();
    expect(qaEvents().filter(entry => entry.event === 'auth_gate_shown')).toHaveLength(0);
  });

  it('AC7: the gated action runs once even if resume is called twice', async () => {
    await renderApp();
    const action = jest.fn();
    await act(() => {
      authGate.open('xp', action);
      authGate.open('xp', action);
    });

    await act(() => {
      authGate.resume();
      authGate.resume();
    });

    expect(action).toHaveBeenCalledTimes(1);
  });
});
