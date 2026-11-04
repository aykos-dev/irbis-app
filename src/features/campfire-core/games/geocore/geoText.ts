import { getLocale, t } from '../../../../shared/i18n';
import { formatNumber } from '../../../../shared/utils/format';
import type { RosterPlayer } from '../../protocol/codec';
import { localized } from '../packs';
import { cities, countries, countryByIso } from './geoData';
import type { GeoMode } from './scoring';

/** Find the country and Capital → Country are answered by tapping a country; the others by a pin. */
export const isCountryMode = (mode: GeoMode) =>
  mode === 'findCountry' || mode === 'capitalToCountry';

export const modeName = (mode: GeoMode) => t(`camp.geo.mode.${mode}`);

/** Whole numbers with the phone's thousands separator. */
export const num = (value: number) => formatNumber(value, getLocale());

export const nameIn = (roster: RosterPlayer[], seatId: string) =>
  roster.find(player => player.seatId === seatId)?.nickname ?? '';

const countryName = (iso: string) => {
  const country = countryByIso(iso);
  return country ? localized(country.name) : iso;
};

/** The prompt card: caption and the big name, looked up locally from `promptId`. */
export function promptText(
  mode: GeoMode,
  promptId: string,
): { caption: string; big: string } {
  const caption = t(`camp.geo.ask.${mode}`);
  if (mode === 'cityDistance') {
    const city = cities.find(item => item.id === promptId);
    return { caption, big: city ? localized(city.name) : '' };
  }
  const country = countries.find(item => item.id === promptId);
  if (!country) {
    return { caption, big: '' };
  }
  return {
    caption,
    big:
      mode === 'capitalToCountry'
        ? localized(country.capital.name)
        : localized(country.name),
  };
}

/** The reveal title: where the answer was. */
export function answerText(mode: GeoMode, promptId: string): string {
  if (mode === 'cityDistance') {
    const city = cities.find(item => item.id === promptId);
    return city
      ? t('camp.geo.reveal.cityIn', {
          city: localized(city.name),
          country: countryName(city.iso),
        })
      : '';
  }
  const country = countries.find(item => item.id === promptId);
  if (!country) {
    return '';
  }
  const names = {
    country: localized(country.name),
    capital: localized(country.capital.name),
  };
  switch (mode) {
    case 'findCountry':
      return t('camp.geo.reveal.country', names);
    case 'capitalToCountry':
      return t('camp.geo.reveal.capitalIn', names);
    default:
      return t('camp.geo.reveal.capitalOf', names);
  }
}

/** A scored guess under the reveal: spot on (country modes), km off, or no answer. */
export function kmLine(mode: GeoMode, km: number | null): string {
  if (km === null) {
    return t('camp.geo.noAnswer');
  }
  return isCountryMode(mode) && km === 0
    ? t('camp.geo.inside')
    : t('camp.geo.kmOff', { km: num(Math.round(km)) });
}

/** "{{km}} km" for a pin label. */
export const kmLabel = (km: number) => t('camp.geo.km', { km: num(Math.round(km)) });
