import { z } from 'zod';

import { getLocale } from '../../../../shared/i18n';
import { qaLog } from '../../../../shared/utils/qaLog';
import crocAnimals from './croc-animals.json';
import crocFamous from './croc-famous.json';
import crocHeroes from './croc-heroes.json';
import imposterAnimals from './imposter-animals.json';
import imposterCamping from './imposter-camping.json';
import imposterFood from './imposter-food.json';
import imposterPlaces from './imposter-places.json';
import ratherCamping from './rather-camping.json';
import ratherTravel from './rather-travel.json';
import whoamiFamous from './whoami-famous.json';
import whoamiThings from './whoami-things.json';

/** The party games that ship (Mafia is still "Coming soon"). */
export const partyGames = ['imposter', 'whoami', 'rather'] as const;
export type PartyGame = (typeof partyGames)[number];
/** Every game that draws from a content pack (Crocodile has its own lobby settings). */
export type PackGame = PartyGame | 'croc';

const text = z.string().trim().min(1);
const localizedSchema = z.object({ uz: text, ru: text, en: text });
export type Localized = z.infer<typeof localizedSchema>;

const id = z.string().min(1);
const wordSchema = localizedSchema.extend({ id });
const questionSchema = z.object({ id, a: localizedSchema, b: localizedSchema });

const packSchema = z
  .discriminatedUnion('game', [
    z.object({
      id,
      game: z.literal('imposter'),
      name: localizedSchema,
      items: z.array(wordSchema).min(1),
    }),
    z.object({
      id,
      game: z.literal('whoami'),
      name: localizedSchema,
      items: z.array(wordSchema).min(1),
    }),
    z.object({
      id,
      game: z.literal('croc'),
      name: localizedSchema,
      items: z.array(wordSchema).min(1),
    }),
    z.object({
      id,
      game: z.literal('rather'),
      name: localizedSchema,
      items: z.array(questionSchema).min(1),
    }),
  ])
  .superRefine((pack, ctx) => {
    const ids = pack.items.map(item => item.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate item id' });
    }
  });

export type Pack = z.infer<typeof packSchema>;
export type WordPack = Extract<Pack, { game: 'imposter' | 'whoami' }>;
export type QuestionPack = Extract<Pack, { game: 'rather' }>;
export type CrocPack = Extract<Pack, { game: 'croc' }>;

/** Validates one content pack: known game, ids unique, uz / ru / en present on every text. */
export function parsePack(raw: unknown): Pack | null {
  const result = packSchema.safeParse(raw);
  return result.success ? result.data : null;
}

const shipped: unknown[] = [
  imposterAnimals,
  imposterCamping,
  imposterFood,
  imposterPlaces,
  whoamiFamous,
  whoamiThings,
  ratherCamping,
  ratherTravel,
];

/** Every valid shipped pack; a broken one is logged and left out (pack ids stay unique). */
export const packs: Pack[] = shipped.reduce<Pack[]>((valid, raw) => {
  const pack = parsePack(raw);
  if (!pack || valid.some(other => other.id === pack.id)) {
    qaLog('camp_pack_invalid', { index: shipped.indexOf(raw) });
    return valid;
  }
  return [...valid, pack];
}, []);

/** Crocodile packs, kept apart from the party packs (own lobby settings: several packs at once). */
const shippedCroc: unknown[] = [crocAnimals, crocHeroes, crocFamous];

export const crocPacks: CrocPack[] = shippedCroc.reduce<CrocPack[]>(
  (valid, raw, index) => {
    const pack = parsePack(raw);
    if (pack?.game !== 'croc' || valid.some(other => other.id === pack.id)) {
      qaLog('camp_pack_invalid', { index, game: 'croc' });
      return valid;
    }
    return [...valid, pack];
  },
  [],
);

export function findCrocPack(packId: string): CrocPack | undefined {
  return crocPacks.find(pack => pack.id === packId);
}

export function packsFor(game: PartyGame): Pack[] {
  return packs.filter(pack => pack.game === game);
}

export function findPack(packId: string): Pack | undefined {
  return packs.find(pack => pack.id === packId);
}

/** Pack text in the phone's app language. */
export function localized(value: Localized): string {
  return value[getLocale()];
}
