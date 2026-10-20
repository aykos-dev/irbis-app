import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';

import { DEBUG_GRANT, parseGrantQuery } from '../../features/debug/grantLink';
import { DEBUG_HEARTS } from '../../features/debug/heartsLink';
import { heartsStore } from '../../features/lessons/heartsStore';
import { markOnboardingDone, resetOnboarding } from '../../features/onboarding/onboardingStore';
import { appConfig } from '../../shared/constants/config';
import { resetGuestMerge } from '../../shared/guest/guestStore';
import { setLocale, supportedLocales } from '../../shared/i18n';
import type { RootStackParamList } from './types';

/**
 * Deep-link config. `irbis://profile` opens the Profile tab; `irbis://place/<id>` opens a place. The debug links
 * (`irbis://debug`, `irbis://debug/status`, `irbis://debug/lang/<uz|ru|en>`,
 * `irbis://debug/onboarding/<reset|done>`, `irbis://debug/levels/grant?xp=&lessons=&tier=&checkins=&difficulty=&spots=`,
 * `irbis://debug/lessons/hearts/<0-5>` sets today's hearts)
 * exist only outside production (AC10). Other planned routes (docs/architecture.md: trips, lessons) are added
 * with the screen they open.
 */
const debugScreens: Record<string, string> = appConfig.isQaEnabled
  ? { Debug: 'debug', Status: 'debug/status' }
  : {};

const DEBUG_LANG = /^\/?debug\/lang\/([^/?#]+)/;
const DEBUG_ONBOARDING = /^\/?debug\/onboarding\/(reset|done)(?:[/?#]|$)/;

type LinkState = ReturnType<typeof getStateFromPath<RootStackParamList>>;

/**
 * `irbis://debug/onboarding/reset` forgets that onboarding ended (and that guest data was merged,
 * so the next sign-in merges again like a fresh install) and restarts it at Splash;
 * `irbis://debug/onboarding/done` marks it ended and opens Debug.
 */
function debugOnboardingState(action: string, options: Parameters<typeof getStateFromPath>[1]): LinkState {
  if (action === 'reset') {
    resetOnboarding();
    resetGuestMerge();
    return { routes: [{ name: 'Onboarding', state: { routes: [{ name: 'Splash' }] } }] };
  }
  markOnboardingDone();
  return getStateFromPath('debug', options);
}

/**
 * `irbis://debug/lang/<code>` (QA harness): a supported code goes through the same setter as the
 * Profile language sheet (persisted), anything else is ignored; either way the link opens Debug.
 */
const debugLangParser: Pick<LinkingOptions<RootStackParamList>, 'getStateFromPath'> =
  appConfig.isQaEnabled
    ? {
        getStateFromPath: (path, options) => {
          const grant = DEBUG_GRANT.exec(path);
          if (grant) {
            return { routes: [{ name: 'Debug', params: parseGrantQuery(grant[1] ?? '') }] };
          }
          const hearts = DEBUG_HEARTS.exec(path);
          if (hearts?.[1]) {
            heartsStore.setHearts(Number(hearts[1]));
            return getStateFromPath('debug', options);
          }
          const onboarding = DEBUG_ONBOARDING.exec(path);
          if (onboarding?.[1]) {
            return debugOnboardingState(onboarding[1], options);
          }
          const match = DEBUG_LANG.exec(path);
          if (!match) {
            return getStateFromPath(path, options);
          }
          const locale = supportedLocales.find(candidate => candidate === match[1]);
          if (locale) {
            setLocale(locale);
          }
          return getStateFromPath('debug', options);
        },
      }
    : {};

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['irbis://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Profile: 'profile',
        },
      },
      Place: 'place/:id',
      ...debugScreens,
    },
  },
  ...debugLangParser,
};
