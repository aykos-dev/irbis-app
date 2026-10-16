import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/**
 * Deep-link config. Planned routes (docs/architecture.md): irbis://places/:placeId,
 * irbis://trips/:tripId, irbis://lessons/:lessonId, irbis://profile — each is added with the
 * screen it opens.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['irbis://'],
  config: {
    screens: {
      Status: 'status',
    },
  },
};
