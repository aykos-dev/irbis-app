import { act, fireEvent, screen } from '@testing-library/react-native';
import HapticFeedback from 'react-native-haptic-feedback';

import { qaEvents, renderApp, sessionBody, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';
import { SPLASH_MS } from '../../../features/onboarding/screens/SplashScreen';
import { storage } from '../../../shared/storage';

let http: HttpStub;

function events(name: string) {
  return qaEvents().filter(entry => entry.event === name);
}

/** Fresh device → Splash → Welcome → Language → Experience. */
async function openExperience() {
  storage.remove('onboarding.done');
  await renderApp({ expectTabs: false });
  await screen.findByTestId('onboarding.splash');
  await act(() => {
    jest.advanceTimersByTime(SPLASH_MS);
  });
  await fireEvent.press(await screen.findByTestId('onboarding.get-started'));
  await screen.findByTestId('onboarding.language');
  await fireEvent.press(screen.getByTestId('onboarding.continue'));
  await screen.findByTestId('onboarding.experience');
}

async function openInterests() {
  await openExperience();
  await fireEvent.press(screen.getByTestId('onboarding.exp-weekend'));
  await fireEvent.press(screen.getByTestId('onboarding.continue'));
  await screen.findByTestId('onboarding.interests');
}

async function openCompanion() {
  await openInterests();
  await fireEvent.press(screen.getByTestId('onboarding.interest-trails'));
  await fireEvent.press(screen.getByTestId('onboarding.interest-peaks'));
  await fireEvent.press(screen.getByTestId('onboarding.continue'));
  await screen.findByTestId('onboarding.companion');
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

describe('onboarding — Experience (AC4)', () => {
  it('AC4: nothing preselected, Continue disabled until a tile is chosen, choice saved on Continue', async () => {
    await openExperience();
    expect(screen.getByTestId('onboarding.progress')).toHaveTextContent('Step 2 of 4');
    expect(screen.getByTestId('onboarding.exp-beginner')).not.toBeSelected();
    expect(screen.getByTestId('onboarding.continue')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('onboarding.exp-weekend'));
    expect(screen.getByTestId('onboarding.exp-weekend')).toBeSelected();
    expect(storage.getString('onboarding.experience')).toBeUndefined();

    await fireEvent.press(screen.getByTestId('onboarding.continue'));

    expect(await screen.findByTestId('onboarding.interests')).toBeOnTheScreen();
    expect(storage.getString('onboarding.experience')).toBe('weekend');
    expect(events('onboarding_step').map(entry => entry.step)).toContain('experience');
  });

  it('AC4: ✕ after picking a tile saves no experience', async () => {
    await openExperience();
    await fireEvent.press(screen.getByTestId('onboarding.exp-experienced'));

    await fireEvent.press(screen.getByTestId('onboarding.close'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(storage.getString('onboarding.experience')).toBeUndefined();
    expect(events('onboarding_end')).toEqual([{ event: 'onboarding_end', via: 'close', interestsCount: 0 }]);
  });
});

describe('onboarding — Interests (AC5)', () => {
  it('AC5: toggles update the counter live; Continue disabled at 0; saved in canonical order', async () => {
    await openInterests();
    const count = screen.getByTestId('onboarding.interests-count');
    expect(screen.getByTestId('onboarding.progress')).toHaveTextContent('Step 3 of 4');
    expect(count).toHaveTextContent('0 selected', { exact: false });
    expect(screen.getByTestId('onboarding.continue')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('onboarding.interest-trails'));
    await fireEvent.press(screen.getByTestId('onboarding.interest-caves'));
    await fireEvent.press(screen.getByTestId('onboarding.interest-peaks'));
    expect(count).toHaveTextContent('3 selected', { exact: false });
    await fireEvent.press(screen.getByTestId('onboarding.interest-caves'));
    expect(count).toHaveTextContent('2 selected', { exact: false });
    expect(screen.getByTestId('onboarding.interest-caves')).not.toBeChecked();
    expect(screen.getByTestId('onboarding.interest-peaks')).toBeChecked();

    await fireEvent.press(screen.getByTestId('onboarding.continue'));

    expect(await screen.findByTestId('onboarding.companion')).toBeOnTheScreen();
    expect(storage.getString('onboarding.interests')).toBe('["peaks","trails"]');
  });

  it('AC5: ✕ on Interests drops the saved experience and saves no interests', async () => {
    await openInterests();
    await fireEvent.press(screen.getByTestId('onboarding.interest-lakes'));

    await fireEvent.press(screen.getByTestId('onboarding.close'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(storage.getString('onboarding.experience')).toBeUndefined();
    expect(storage.getString('onboarding.interests')).toBeUndefined();
    expect(events('onboarding_end')).toEqual([{ event: 'onboarding_end', via: 'close', interestsCount: 0 }]);
  });
});

describe('onboarding — Companion (AC6)', () => {
  it("AC6: the reveal plays a success haptic and Let's go ends onboarding with the choices", async () => {
    await openCompanion();
    expect(HapticFeedback.trigger).toHaveBeenCalledWith('notificationSuccess', expect.anything());
    expect(screen.getByLabelText('Locked companions')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding.progress')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('onboarding.lets-go'));

    expect(await screen.findByTestId('nav.tab-path')).toBeOnTheScreen();
    expect(storage.getString('onboarding.done')).toBe('1');
    expect(events('onboarding_step').map(entry => entry.step)).toEqual([
      'splash',
      'welcome',
      'language',
      'experience',
      'interests',
      'companion',
    ]);
    expect(events('onboarding_end')).toEqual([
      { event: 'onboarding_end', via: 'finish', experience: 'weekend', interestsCount: 2 },
    ]);
  });
});
