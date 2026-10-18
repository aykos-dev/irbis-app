import type { PlaceConditionDto } from '../../../api/generated/model';
import { i18n } from '../../../i18n';
import { conditionLines, reasonText, updatedAgo } from '../reasonText';
import { weatherKind } from '../weatherGlyph';

/** Synthetic condition — not a real place. */
const condition = (overrides: Partial<PlaceConditionDto> = {}): PlaceConditionDto => ({
  placeId: '00000000-0000-4000-8000-0000000000c1',
  status: 'caution',
  source: 'forecast',
  reasons: [],
  text: null,
  opensMonth: null,
  hazards: [],
  weekend: [],
  forecastAt: null,
  computedAt: null,
  ...overrides,
});

beforeEach(() => {
  i18n.locale = 'en';
});

describe('conditions — reasonText (AC7)', () => {
  it.each([
    [{ code: 'THUNDERSTORM', day: 'sat' }, 'Thunderstorm on Saturday'],
    [{ code: 'GUSTS', day: 'sun', value: 62 }, 'Gusts up to 62 km/h on Sunday'],
    [{ code: 'HEAVY_PRECIP', day: 'sat', value: 24.5 }, 'Heavy rain or snow on Saturday — 24.5 mm'],
    [{ code: 'WIND', day: 'sat', value: 45 }, 'Strong wind on Saturday — 45 km/h'],
    [{ code: 'PRECIP_LIKELY', day: 'sun', value: 70 }, 'Rain likely on Sunday — 70%'],
    [{ code: 'HEAT', day: 'sat', value: 38 }, 'Heat on Saturday — up to 38°'],
    [{ code: 'COLD', day: 'sun', value: -15 }, 'Severe cold on Sunday — down to -15°'],
    [{ code: 'MUDSLIDE_RISK', day: 'sat' }, 'Mudslide risk after rain on Saturday'],
    [{ code: 'FLOOD_RISK', day: 'sun' }, 'Flood risk after rain on Sunday'],
    [{ code: 'AVALANCHE_RISK', value: 30 }, 'Avalanche risk — 30 cm of fresh snow'],
    [{ code: 'GOOD_WEATHER', day: 'sat', value: 12 }, 'Good weather on Saturday, wind up to 12 km/h'],
  ] as const)('AC7: %o reads "%s"', (reason, text) => {
    expect(reasonText(reason, 'en')).toBe(text);
  });

  it('AC7: renders the day and template in ru and uz', () => {
    expect(reasonText({ code: 'THUNDERSTORM', day: 'sat' }, 'ru')).toBe('Гроза в субботу');
    expect(reasonText({ code: 'THUNDERSTORM', day: 'sun' }, 'uz')).toBe('Yakshanba kuni momaqaldiroq');
  });

  it('AC7: closure / manual show the admin text in the locale, falling back to Uzbek', () => {
    const closed = condition({
      status: 'not_now',
      source: 'closure',
      reasons: [{ code: 'CLOSURE' }],
      text: { uz: 'Yoʻl yopiq', ru: null, en: 'Road closed' },
    });
    expect(conditionLines(closed, 'en')).toEqual(['Road closed']);
    expect(conditionLines(closed, 'ru')).toEqual(['Yoʻl yopiq']);
  });

  it('AC7: shows at most three forecast reasons', () => {
    const many = condition({
      reasons: [
        { code: 'THUNDERSTORM', day: 'sat' },
        { code: 'WIND', day: 'sat', value: 45 },
        { code: 'PRECIP_LIKELY', day: 'sun', value: 70 },
        { code: 'HEAT', day: 'sun', value: 38 },
      ],
    });
    expect(conditionLines(many, 'en')).toHaveLength(3);
  });

  it('AC7: relative "Updated" age and weather glyph buckets', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    expect(updatedAgo('2026-10-17T11:59:30Z', now)).toBe('just now');
    expect(updatedAgo('2026-10-17T11:48:00Z', now)).toBe('12 min ago');
    expect(updatedAgo('2026-10-17T09:00:00Z', now)).toBe('3 h ago');
    expect(updatedAgo('2026-10-15T12:00:00Z', now)).toBe('2 d ago');
    expect([0, 3, 45, 61, 81, 73, 86, 95].map(weatherKind)).toEqual([
      'sun', 'cloud', 'cloud', 'rain', 'rain', 'snow', 'snow', 'storm',
    ]);
  });
});
