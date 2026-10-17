import { fireEvent, screen } from '@testing-library/react-native';

import {
  meBody,
  openTab,
  qaEvents,
  renderApp,
  sessionBody,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';
import { saveExperience, saveInterests } from '../../../features/onboarding/onboardingStore';
import { collectGuestData } from '../../../shared/guest/guestStore';
import { getLocale } from '../../../shared/i18n';
import { storage } from '../../../shared/storage';

let http: HttpStub;

const MERGE = '/v1/me/guest-merge';

beforeEach(async () => {
  http = await setUpApp();
  http.reply('/v1/me', { status: 200, body: meBody() });
  http.reply(MERGE, { status: 200, body: { merged: ['onboarding'], skipped: ['locale'] } });
});
afterEach(async () => {
  await tearDownApp(http);
});

function localeEvents() {
  return qaEvents().filter(entry => entry.event === 'locale_applied');
}

describe('onboarding — choices into the account (AC7)', () => {
  it('AC7: saved experience and interests go into the merge payload', () => {
    saveExperience('weekend');
    saveInterests(['lakes', 'peaks']);

    expect(collectGuestData()).toEqual({
      locale: 'en',
      onboarding: { experience: 'weekend', interests: ['peaks', 'lakes'] },
    });
  });

  it('AC7: nothing chosen (✕ path) sends no onboarding; an empty list is left out', () => {
    expect(collectGuestData()).toEqual({ locale: 'en' });

    saveExperience('beginner');
    saveInterests([]);
    expect(collectGuestData()).toEqual({ locale: 'en', onboarding: { experience: 'beginner' } });
  });

  it('AC7: stored values the API does not know are dropped', () => {
    storage.setString('onboarding.experience', 'expert');
    storage.setString('onboarding.interests', JSON.stringify(['caves', 'volcanoes']));

    expect(collectGuestData()).toEqual({ locale: 'en', onboarding: { interests: ['caves'] } });
  });

  it('AC7: the choices are sent once after log-in and kept on the device', async () => {
    http.reply('/v1/auth/log-in', { status: 200, body: sessionBody() });
    saveExperience('experienced');
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.guest-login'));
    await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('profile.username');

    expect(JSON.parse(String(http.callsTo(MERGE)[0]?.data))).toEqual({
      locale: 'en',
      onboarding: { experience: 'experienced' },
    });
    expect(storage.getString('onboarding.experience')).toBe('experienced');
  });
});

describe('onboarding — account language wins on log-in (AC8)', () => {
  it('AC8: after log-in the account language replaces the device one; locale_applied is logged', async () => {
    http.reply('/v1/auth/log-in', { status: 200, body: sessionBody({ locale: 'ru' }) });
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.guest-login'));
    await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('profile.username');

    expect(JSON.parse(String(http.callsTo(MERGE)[0]?.data))).toEqual({ locale: 'en' });
    expect(getLocale()).toBe('ru');
    expect(localeEvents()).toEqual([{ event: 'locale_applied', locale: 'ru' }]);
  });

  it('AC8: sign-up keeps the device language', async () => {
    http.reply('/v1/auth/sign-up', { status: 201, body: sessionBody({ locale: 'ru' }) });
    http.reply('/v1/auth/username-available', { status: 200, body: { available: true } });
    await renderApp();
    await openTab('profile');
    await fireEvent.press(await screen.findByTestId('profile.guest-signup'));
    await fireEvent.changeText(await screen.findByTestId('auth.username'), 'guest_1');
    await fireEvent.changeText(screen.getByTestId('auth.password'), 'Sunrise-42');
    await fireEvent.press(screen.getByTestId('auth.terms'));
    await fireEvent.press(screen.getByTestId('auth.submit'));
    await screen.findByTestId('profile.username');

    expect(getLocale()).toBe('en');
    expect(localeEvents()).toHaveLength(0);
  });
});
