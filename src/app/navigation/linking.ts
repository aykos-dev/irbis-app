import type { LinkingOptions } from '@react-navigation/native';

import { appConfig } from '../../shared/constants/config';
import type { RootStackParamList } from './types';

/**
 * Deep-link config. `irbis://profile` opens the Profile tab. The debug links
 * (`irbis://debug`, `irbis://debug/status`) exist only outside production (AC10). Other planned
 * routes (docs/architecture.md: places, trips, lessons) are added with the screen they open.
 */
const debugScreens: Record<string, string> = appConfig.isQaEnabled
  ? { Debug: 'debug', Status: 'debug/status' }
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
};
