import { getStateFromPath, type LinkingOptions } from '@react-navigation/native';

import { appConfig } from '../../shared/constants/config';
import { setLocale, supportedLocales } from '../../shared/i18n';
import type { RootStackParamList } from './types';

/**
 * Deep-link config. `irbis://profile` opens the Profile tab. The debug links
 * (`irbis://debug`, `irbis://debug/status`, `irbis://debug/lang/<uz|ru|en>`) exist only outside
 * production (AC10). Other planned routes (docs/architecture.md: places, trips, lessons) are added
 * with the screen they open.
 */
const debugScreens: Record<string, string> = appConfig.isQaEnabled
  ? { Debug: 'debug', Status: 'debug/status' }
  : {};

const DEBUG_LANG = /^\/?debug\/lang\/([^/?#]+)/;

/**
 * `irbis://debug/lang/<code>` (QA harness): a supported code goes through the same setter as the
 * Profile language sheet (persisted), anything else is ignored; either way the link opens Debug.
 */
const debugLangParser: Pick<LinkingOptions<RootStackParamList>, 'getStateFromPath'> =
  appConfig.isQaEnabled
    ? {
        getStateFromPath: (path, options) => {
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
      ...debugScreens,
    },
  },
  ...debugLangParser,
};
