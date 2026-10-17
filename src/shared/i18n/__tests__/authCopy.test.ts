import enAuth from '../en/auth.json';
import enDebug from '../en/debug.json';
import enNav from '../en/nav.json';
import ruAuth from '../ru/auth.json';
import ruDebug from '../ru/debug.json';
import ruNav from '../ru/nav.json';
import uzAuth from '../uz/auth.json';
import uzDebug from '../uz/debug.json';
import uzNav from '../uz/nav.json';
import { i18n } from '..';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('auth copy (uz / ru / en)', () => {
  it.each([
    ['auth', enAuth, ruAuth, uzAuth],
    ['nav', enNav, ruNav, uzNav],
    ['debug', enDebug, ruDebug, uzDebug],
  ])('%s has the same keys in every language, except plural forms', (_name, en, ru, uz) => {
    const strip = (list: string[]) =>
      list.filter(key => !/\.(one|few|many|other)$/.test(key)).sort();
    expect(strip(keys(ru))).toEqual(strip(keys(en)));
    expect(strip(keys(uz))).toEqual(strip(keys(en)));
  });

  it('pluralises the lock minutes per locale (Russian one / few / many)', () => {
    const minutes = (locale: string, count: number) => i18n.t('auth.minutes', { count, locale });

    expect(minutes('en', 1)).toBe('1 minute');
    expect(minutes('en', 15)).toBe('15 minutes');
    expect(minutes('ru', 1)).toBe('1 минуту');
    expect(minutes('ru', 3)).toBe('3 минуты');
    expect(minutes('ru', 15)).toBe('15 минут');
    expect(minutes('uz', 15)).toBe('15 daqiqa');
  });
});
