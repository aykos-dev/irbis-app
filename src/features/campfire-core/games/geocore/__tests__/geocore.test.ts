import { storage } from '../../../../../shared/storage';
import { readUsed } from '../../usedStore';
import {
  cities,
  countries,
  countryByIso,
  countryFeatures,
  microstates,
} from '../geoData';
import { drawPrompts } from '../prompts';
import {
  cityPoints,
  countryPoints,
  kmToCountry,
  scoreGuess,
} from '../scoring';

let log: jest.SpyInstance;
beforeEach(() => {
  storage.clearAll();
  log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => log.mockRestore());

/** Deterministic rng (LCG) so the shuffles are repeatable. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

describe('campfire-geocore — packs', () => {
  it('Data: 195 countries with unique ids, uz/ru/en and a capital; 200 cities', () => {
    expect(countries).toHaveLength(195);
    expect(new Set(countries.map(c => c.id)).size).toBe(195);
    expect(new Set(countries.map(c => c.iso)).size).toBe(195);
    for (const country of countries) {
      expect(country.name.uz && country.name.ru && country.name.en).toBeTruthy();
      expect(country.capital.name.en).toBeTruthy();
    }
    expect(cities).toHaveLength(200);
    expect(new Set(cities.map(c => c.id)).size).toBe(200);
    expect(countryByIso('ke')?.name.en).toBe('Kenya');
  });

  it('Data: every country is drawn — in the 110m topology or listed as a microstate', () => {
    const micro = new Set(microstates.map(m => m.iso));
    const missing = countries.filter(
      c => !countryFeatures.has(c.n3) && !micro.has(c.iso),
    );
    expect(missing).toEqual([]);
  });
});

describe('campfire-geocore — scoring (AC5)', () => {
  it('AC5: country and city curves', () => {
    const kms = [0, 100, 500, 1500, 5000];
    expect(kms.map(countryPoints)).toEqual([1000, 936, 717, 368, 36]);
    expect(kms.map(cityPoints)).toEqual([5000, 4756, 3894, 2362, 410]);
  });

  it('AC5: kmToCountry — inside, nearby, microstate, antimeridian', () => {
    expect(kmToCountry({ lat: -1.29, lng: 36.82 }, 'KE')).toBe(0);
    const tanzania = kmToCountry({ lat: -3.4, lng: 35.6 }, 'KE');
    expect(tanzania).toBeGreaterThanOrEqual(115);
    expect(tanzania).toBeLessThanOrEqual(175);
    expect(kmToCountry({ lat: 41.904, lng: 12.453 }, 'VA')).toBe(0);
    expect(kmToCountry({ lat: 66, lng: -172 }, 'RU')).toBe(0);
    expect(kmToCountry({ lat: -17.8, lng: 178.0 }, 'FJ')).toBe(0);
    const offFiji = kmToCountry({ lat: -17, lng: -178 }, 'FJ');
    expect(offFiji).toBeGreaterThan(0);
    expect(offFiji).toBeLessThan(300);
  });

  it('AC5: scoreGuess per mode; a timeout scores 0; results are integers', () => {
    const nairobi = { lat: -1.29, lng: 36.82 };
    expect(scoreGuess('findCountry', 'ke', nairobi)).toEqual({ km: 0, points: 1000 });
    expect(scoreGuess('capitalToCountry', 'ke', nairobi)).toEqual({ km: 0, points: 1000 });

    const toCapital = scoreGuess('countryToCapital', 'uz', { lat: 39.65, lng: 66.96 });
    expect(toCapital.km).toBeGreaterThan(250);
    expect(toCapital.km).toBeLessThan(290);
    expect(toCapital.points).toBe(countryPoints(toCapital.km ?? 0));

    const city = scoreGuess('cityDistance', 'city-tashkent', { lat: 39.65, lng: 66.96 });
    expect(Number.isInteger(city.km)).toBe(true);
    expect(city.points).toBe(cityPoints(city.km ?? 0));

    expect(scoreGuess('findCountry', 'ke', null)).toEqual({ km: null, points: 0 });
    expect(scoreGuess('cityDistance', 'city-tashkent', null)).toEqual({ km: null, points: 0 });
  });
});

describe('campfire-geocore — prompts', () => {
  it('drawPrompts: 10 distinct, no repeats across draws until the pack runs out, then reset', () => {
    const rng = seeded(7);
    const first = drawPrompts('findCountry', 10, rng);
    expect(new Set(first).size).toBe(10);
    expect(first.every(id => countries.some(c => c.id === id))).toBe(true);
    const second = drawPrompts('findCountry', 10, rng);
    expect(second.some(id => first.includes(id))).toBe(false);
    expect(readUsed('geo', 'findCountry')).toHaveLength(20);

    const city = drawPrompts('cityDistance', 10, rng);
    expect(city.every(id => cities.some(c => c.id === id))).toBe(true);

    // 195 countries: 19 draws use 190, the 20th has only 5 left → the pack starts over.
    for (let i = 2; i < 19; i += 1) {
      drawPrompts('findCountry', 10, rng);
    }
    expect(readUsed('geo', 'findCountry')).toHaveLength(190);
    const afterReset = drawPrompts('findCountry', 10, rng);
    expect(new Set(afterReset).size).toBe(10);
    expect(readUsed('geo', 'findCountry')).toEqual(afterReset);
  });
});
