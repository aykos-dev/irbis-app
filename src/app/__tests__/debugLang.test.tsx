import { getStateFromPath } from '@react-navigation/native';

import { linking } from '../navigation/linking';
import { getLocale, getSavedLocale, i18n } from '../../shared/i18n';
import { storage } from '../../shared/storage';

function openLink(path: string) {
  const parse = linking.getStateFromPath ?? getStateFromPath;
  return parse(path, linking.config);
}

beforeEach(() => {
  storage.clearAll();
  i18n.locale = 'en';
});

describe('debug — irbis://debug/lang/<code> (QA harness, dev/staging only)', () => {
  it('a supported code sets and persists the in-app language, then opens Debug', () => {
    const state = openLink('debug/lang/ru');

    expect(state?.routes[0]?.name).toBe('Debug');
    expect(getLocale()).toBe('ru');
    expect(getSavedLocale()).toBe('ru');
  });

  it('an unsupported code is ignored: language unchanged, nothing persisted', () => {
    const state = openLink('debug/lang/de');

    expect(state?.routes[0]?.name).toBe('Debug');
    expect(getLocale()).toBe('en');
    expect(getSavedLocale()).toBeUndefined();
  });

  it('is not a deep link in production builds and changes nothing', () => {
    jest.resetModules();
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: { API_URL: 'http://localhost:3000', APP_ENV: 'prod' },
    }));
    const { linking: prodLinking } = require('../navigation/linking');
    const prodI18n = require('../../shared/i18n');

    expect(prodLinking.getStateFromPath).toBeUndefined();
    expect(getStateFromPath('debug/lang/ru', prodLinking.config)).toBeUndefined();
    expect(prodI18n.getSavedLocale()).toBeUndefined();
    jest.dontMock('react-native-config');
    jest.resetModules();
  });
});
