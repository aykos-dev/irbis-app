import { useSyncExternalStore } from 'react';

import { getLocale, i18n, type Locale } from '../i18n';

function subscribe(onChange: () => void): () => void {
  return i18n.onChange(onChange);
}

/**
 * The active locale, re-rendering the caller when it changes. Screens that stay mounted while the
 * user switches language (tab screens, the tab bar) call this so their `t()` strings refresh;
 * screens that open afresh read the new locale anyway.
 */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}
