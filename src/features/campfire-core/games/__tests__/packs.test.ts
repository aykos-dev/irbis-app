import { setLocale } from '../../../../shared/i18n';
import { storage } from '../../../../shared/storage';
import { findPack, localized, packs, packsFor, parsePack } from '../packs';
import { drawIds, readUsed } from '../usedStore';

const word = (id: string) => ({ id, uz: `${id}_uz`, ru: `${id}_ru`, en: `${id}_en` });
const name = { uz: 'n_uz', ru: 'n_ru', en: 'n_en' };

let log: jest.SpyInstance;
beforeEach(() => {
  storage.clearAll();
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  log.mockRestore();
  setLocale('en');
});

const qaEvents = () =>
  log.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.startsWith('IRBIS_QA '))
    .map(line => JSON.parse(line.slice('IRBIS_QA '.length)));

describe('campfire-party — packs and no-repeat (AC8)', () => {
  it('AC8: all 8 shipped packs load; duplicate ids or a missing language are rejected; text follows the app language', () => {
    expect(packs).toHaveLength(8);
    expect(packsFor('imposter')).toHaveLength(4);
    expect(packsFor('whoami')).toHaveLength(2);
    expect(packsFor('rather')).toHaveLength(2);

    const valid = { id: 'pack_1', game: 'imposter', name, items: [word('a'), word('b')] };
    expect(parsePack(valid)).not.toBeNull();
    expect(parsePack({ ...valid, items: [word('a'), word('a')] })).toBeNull();
    expect(
      parsePack({ ...valid, items: [{ id: 'a', uz: 'a', en: 'a' }] }),
    ).toBeNull();
    expect(parsePack({ ...valid, game: 'mafia' })).toBeNull();

    const animals = findPack('imposter-animals');
    expect(animals && localized(animals.name)).toBe('Animals');
    setLocale('ru');
    expect(animals && localized(animals.name)).toBe('Животные');
  });

  it('AC8: dealing picks only unused ids and remembers them; when too few are left the pack reshuffles', () => {
    const pack = parsePack({
      id: 'pack_1',
      game: 'whoami',
      name,
      items: ['a', 'b', 'c', 'd', 'e'].map(word),
    });
    if (!pack) {
      throw new Error('invalid pack');
    }
    const first = drawIds('whoami', pack, 3, Math.random);
    expect(readUsed('whoami', 'pack_1')).toEqual(first);
    expect(storage.getString('camp.used.whoami.pack_1')).toBe(JSON.stringify(first));

    const second = drawIds('whoami', pack, 2, Math.random);
    expect(second.some(id => first.includes(id))).toBe(false);
    expect(qaEvents()).not.toContainEqual(
      expect.objectContaining({ event: 'camp_pack_reshuffled' }),
    );

    const third = drawIds('whoami', pack, 3, Math.random);
    expect(new Set(third).size).toBe(3);
    expect(readUsed('whoami', 'pack_1')).toEqual(third);
    expect(qaEvents()).toContainEqual({
      event: 'camp_pack_reshuffled',
      game: 'whoami',
      pack: 'pack_1',
    });
  });
});
