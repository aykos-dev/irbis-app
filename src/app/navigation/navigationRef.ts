import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/** Navigation from outside React (push taps, deep links). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
