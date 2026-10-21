import { I18n, type TranslateOptions } from 'i18n-js';
import { findBestLanguageTag } from 'react-native-localize';

import { storage } from '../storage';

import enAuth from './en/auth.json';
import enCamp from './en/camp.json';
import enCommon from './en/common.json';
import enConditions from './en/conditions.json';
import enDebug from './en/debug.json';
import enErrors from './en/errors.json';
import enHealth from './en/health.json';
import enLessons from './en/lessons.json';
import enLevels from './en/levels.json';
import enNav from './en/nav.json';
import enOnboarding from './en/onboarding.json';
import enPath from './en/path.json';
import enPlaces from './en/places.json';
import enTrip from './en/trip.json';
import ruAuth from './ru/auth.json';
import ruCamp from './ru/camp.json';
import ruCommon from './ru/common.json';
import ruConditions from './ru/conditions.json';
import ruDebug from './ru/debug.json';
import ruErrors from './ru/errors.json';
import ruHealth from './ru/health.json';
import ruLessons from './ru/lessons.json';
import ruLevels from './ru/levels.json';
import ruNav from './ru/nav.json';
import ruOnboarding from './ru/onboarding.json';
import ruPath from './ru/path.json';
import ruPlaces from './ru/places.json';
import ruTrip from './ru/trip.json';
import uzAuth from './uz/auth.json';
import uzCamp from './uz/camp.json';
import uzCommon from './uz/common.json';
import uzConditions from './uz/conditions.json';
import uzDebug from './uz/debug.json';
import uzErrors from './uz/errors.json';
import uzHealth from './uz/health.json';
import uzLessons from './uz/lessons.json';
import uzLevels from './uz/levels.json';
import uzNav from './uz/nav.json';
import uzOnboarding from './uz/onboarding.json';
import uzPath from './uz/path.json';
import uzPlaces from './uz/places.json';
import uzTrip from './uz/trip.json';

/**
 * i18n setup. Translations live in `<locale>/<namespace>.json`; keys are `<namespace>.<key>`
 * (e.g. `common.retry`). In M0 the locale follows the device; onboarding will let the user pick.
 */
export const supportedLocales = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];

/** Each language in its own language (never translated). */
export const languageNames: Record<Locale, string> = {
  uz: 'Oʻzbekcha',
  ru: 'Русский',
  en: 'English',
};

const fallbackLocale: Locale = 'en';

export const i18n = new I18n({
  en: {
    auth: enAuth,
    camp: enCamp,
    common: enCommon,
    conditions: enConditions,
    debug: enDebug,
    nav: enNav,
    errors: enErrors,
    health: enHealth,
    lessons: enLessons,
    levels: enLevels,
    onboarding: enOnboarding,
    path: enPath,
    places: enPlaces,
    trip: enTrip,
  },
  ru: {
    auth: ruAuth,
    camp: ruCamp,
    common: ruCommon,
    conditions: ruConditions,
    debug: ruDebug,
    nav: ruNav,
    errors: ruErrors,
    health: ruHealth,
    lessons: ruLessons,
    levels: ruLevels,
    onboarding: ruOnboarding,
    path: ruPath,
    places: ruPlaces,
    trip: ruTrip,
  },
  uz: {
    auth: uzAuth,
    camp: uzCamp,
    common: uzCommon,
    conditions: uzConditions,
    debug: uzDebug,
    nav: uzNav,
    errors: uzErrors,
    health: uzHealth,
    lessons: uzLessons,
    levels: uzLevels,
    onboarding: uzOnboarding,
    path: uzPath,
    places: uzPlaces,
    trip: uzTrip,
  },
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

function isLocale(value: string | undefined): value is Locale {
  return supportedLocales.some(locale => locale === value);
}

const savedLocale = storage.getString('prefs.locale');
i18n.locale = isLocale(savedLocale) ? savedLocale : detectDeviceLocale();

/** The user's explicit choice (Language row); persisted in MMKV and merged on first sign-in. */
export function setLocale(locale: Locale): void {
  i18n.locale = locale;
  storage.setString('prefs.locale', locale);
}

/** The explicit choice only — undefined while the app just follows the device. */
export function getSavedLocale(): Locale | undefined {
  const saved = storage.getString('prefs.locale');
  return isLocale(saved) ? saved : undefined;
}

export function getLocale(): Locale {
  return i18n.locale as Locale;
}

export function t(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}
