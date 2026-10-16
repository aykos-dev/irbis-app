import { I18n, type TranslateOptions } from 'i18n-js';
import { findBestLanguageTag } from 'react-native-localize';

import enCommon from './en/common.json';
import enErrors from './en/errors.json';
import enHealth from './en/health.json';
import ruCommon from './ru/common.json';
import ruErrors from './ru/errors.json';
import ruHealth from './ru/health.json';
import uzCommon from './uz/common.json';
import uzErrors from './uz/errors.json';
import uzHealth from './uz/health.json';

/**
 * i18n setup. Translations live in `<locale>/<namespace>.json`; keys are `<namespace>.<key>`
 * (e.g. `common.retry`). In M0 the locale follows the device; onboarding will let the user pick.
 */
export const supportedLocales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];

const fallbackLocale: Locale = 'en';

export const i18n = new I18n({
  en: { common: enCommon, errors: enErrors, health: enHealth },
  ru: { common: ruCommon, errors: ruErrors, health: ruHealth },
  uz: { common: uzCommon, errors: uzErrors, health: uzHealth },
});

i18n.defaultLocale = fallbackLocale;
i18n.enableFallback = true;

/** Russian plural categories (one / few / many / other). Hermes has no Intl.PluralRules. */
export function russianPluralKeys(count: number): string[] {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (!Number.isInteger(count)) {
    return ['other'];
  }
  if (mod10 === 1 && mod100 !== 11) {
    return ['one'];
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return ['few'];
  }
  return ['many', 'other'];
}

i18n.pluralization.register('ru', (_i18n, count) => russianPluralKeys(count));

export function detectDeviceLocale(): Locale {
  const best = findBestLanguageTag([...supportedLocales]);
  return best?.languageTag ?? fallbackLocale;
}

i18n.locale = detectDeviceLocale();

export function getLocale(): Locale {
  return i18n.locale as Locale;
}

export function t(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}
