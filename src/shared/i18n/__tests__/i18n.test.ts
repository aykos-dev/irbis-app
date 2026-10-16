import en from '../en/common.json';
import enErrors from '../en/errors.json';
import ru from '../ru/common.json';
import ruErrors from '../ru/errors.json';
import uz from '../uz/common.json';
import uzErrors from '../uz/errors.json';
import { detectDeviceLocale, russianPluralKeys } from '..';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n', () => {
  it('has the same keys in uz, ru and en', () => {
    expect(keys(uz).sort()).toEqual(keys(en).sort());
    expect(keys(ru).sort()).toEqual(keys(en).sort());
    expect(keys(uzErrors).sort()).toEqual(keys(enErrors).sort());
    expect(keys(ruErrors).sort()).toEqual(keys(enErrors).sort());
  });

  it('follows the device locale', () => {
    expect(detectDeviceLocale()).toBe('en');
  });

  it.each([
    [1, 'one'],
    [21, 'one'],
    [2, 'few'],
    [24, 'few'],
    [5, 'many'],
    [11, 'many'],
    [12, 'many'],
    [111, 'many'],
    [0, 'many'],
  ])('russian plural for %i is %s', (count, category) => {
    expect(russianPluralKeys(count)[0]).toBe(category);
  });
});
