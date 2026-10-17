/* Native-module test doubles for Jest. Lives outside src/ on purpose. */
require('react-native-reanimated').setUpTests();
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { API_URL: 'http://localhost:3000', APP_ENV: 'dev' },
}));
jest.mock('react-native-localize', () => ({
  findBestLanguageTag: () => ({ languageTag: 'en', isRTL: false }),
  getLocales: () => [
    { languageCode: 'en', languageTag: 'en-US', countryCode: 'US', isRTL: false },
  ],
}));
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
}));
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
}));
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  return {
    createMMKV: ({ id }) => {
      const data = stores.get(id) ?? new Map();
      stores.set(id, data);
      return {
        getString: key => data.get(key),
        set: (key, value) => {
          data.set(key, value);
        },
        remove: key => data.delete(key),
        clearAll: () => data.clear(),
      };
    },
  };
});
jest.mock('@gorhom/bottom-sheet', () => {
  const base = require('@gorhom/bottom-sheet/mock');
  // The stock mock never reports a dismissal; the real modal calls onDismiss once it is gone.
  class BottomSheetModal extends base.BottomSheetModal {
    dismiss() {
      super.dismiss();
      if (this.props.onDismiss) {
        this.props.onDismiss();
      }
    }
  }
  return { ...base, BottomSheetModal };
});

/*
 * Every app-level test runs on a returning device (onboarding already ended) unless it opts into
 * first launch by removing `onboarding.done` (see src/app/__tests__/onboarding).
 */
beforeEach(() => {
  require('./src/shared/storage').storage.setString('onboarding.done', '1');
});
