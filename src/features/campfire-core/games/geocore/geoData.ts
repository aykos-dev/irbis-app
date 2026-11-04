import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { z } from 'zod';

import { qaLog } from '../../../../shared/utils/qaLog';
import rawCities from './data/geo-cities.json';
import rawCountries from './data/geo-countries.json';
import rawMicrostates from './data/microstates.json';
import rawTopology from './data/world-110m.topo.json';

const text = z.string().trim().min(1);
const localizedSchema = z.object({ uz: text, ru: text, en: text });
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const iso = z.string().regex(/^[A-Z]{2}$/);

const countrySchema = z.object({
  id: z.string().min(1),
  iso,
  n3: z.string().regex(/^\d{3}$/),
  continent: text,
  name: localizedSchema,
  lat,
  lng,
  capital: z.object({ name: localizedSchema, lat, lng }),
});
export type GeoCountry = z.infer<typeof countrySchema>;

const citySchema = z.object({
  id: z.string().min(1),
  iso,
  name: localizedSchema,
  lat,
  lng,
});
export type GeoCity = z.infer<typeof citySchema>;

const microstateSchema = z.object({ iso, lat, lng, reason: text });
export type GeoMicrostate = z.infer<typeof microstateSchema>;

const uniqueIds = (items: { id: string }[], ctx: z.RefinementCtx) => {
  const ids = items.map(item => item.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', message: 'duplicate item id' });
  }
};

const geoPack = <T extends z.ZodType<{ id: string }>>(item: T) =>
  z.object({
    id: z.string().min(1),
    game: z.literal('geo'),
    items: z.array(item).min(1).superRefine(uniqueIds),
  });

const countriesPackSchema = geoPack(countrySchema);
const citiesPackSchema = geoPack(citySchema);
const microstatesSchema = z.object({ items: z.array(microstateSchema) });

const arcIndexes = z.array(z.number().int());
const pair = z.tuple([z.number(), z.number()]);
const topologySchema = z.object({
  type: z.literal('Topology'),
  arcs: z.array(z.array(z.array(z.number()))),
  transform: z.object({ scale: pair, translate: pair }).optional(),
  objects: z.object({
    countries: z.object({
      type: z.literal('GeometryCollection'),
      geometries: z.array(
        z.discriminatedUnion('type', [
          z.object({
            type: z.literal('Polygon'),
            id: z.string().optional(),
            arcs: z.array(arcIndexes),
          }),
          z.object({
            type: z.literal('MultiPolygon'),
            id: z.string().optional(),
            arcs: z.array(z.array(arcIndexes)),
          }),
        ]),
      ),
    }),
  }),
});

/** Parses one shipped geo file; a broken one is logged and replaced by `fallback` (never a crash). */
function load<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  pack: string,
  fallback: T,
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    qaLog('camp_pack_invalid', { game: 'geo', pack });
    return fallback;
  }
  return result.data;
}

const emptyPack = { id: '', game: 'geo' as const, items: [] };

export const countries: GeoCountry[] = load(
  countriesPackSchema,
  rawCountries,
  'geo-countries',
  emptyPack,
).items;

export const cities: GeoCity[] = load(
  citiesPackSchema,
  rawCities,
  'geo-cities',
  emptyPack,
).items;

/** Countries drawn as round tap buttons (missing from 110m or too small to tap). */
export const microstates: GeoMicrostate[] = load(
  microstatesSchema,
  rawMicrostates,
  'microstates',
  { items: [] },
).items;

export type CountryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

function buildFeatures(): Map<string, CountryFeature> {
  const parsed = load(topologySchema, rawTopology, 'world-110m', null);
  const byN3 = new Map<string, CountryFeature>();
  if (!parsed) {
    return byN3;
  }
  const topology: Topology<{ countries: GeometryCollection }> = parsed;
  for (const item of feature(topology, topology.objects.countries).features) {
    const { geometry } = item;
    if (
      typeof item.id === 'string' &&
      (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')
    ) {
      byN3.set(item.id, { ...item, geometry });
    }
  }
  return byN3;
}

/** Country outlines from the 110m topology, by ISO numeric code (`n3`). */
export const countryFeatures: ReadonlyMap<string, CountryFeature> =
  buildFeatures();

export function countryByIso(code: string): GeoCountry | undefined {
  const upper = code.toUpperCase();
  return countries.find(country => country.iso === upper);
}

export function microstateByIso(code: string): GeoMicrostate | undefined {
  const upper = code.toUpperCase();
  return microstates.find(item => item.iso === upper);
}
