import animalsRaw from '../../packs/croc-animals.json';
import { storage } from '../../../../../shared/storage';
import { decodeClient } from '../../../protocol/codec';
import {
  gameReducer,
  inRange,
  toCrocPublic,
  type CrocState,
  type GameSeat,
} from '../../gameReducer';
import { crocPacks, findCrocPack, parsePack } from '../../packs';
import { drawIds, readUsed } from '../../usedStore';

const seats = (n: number): GameSeat[] =>
  Array.from({ length: n }, (_, i) => ({
    seatId: i === 0 ? 'host' : `p${i}`,
    connected: true,
  }));

const settings = { durationSec: 60, packs: ['croc-animals'] };
const word = (id: string) => ({ id, pack: 'croc-animals' });

function ready(): CrocState {
  const started = gameReducer(null, { type: 'startCroc', settings, seats: seats(3) });
  const picked = gameReducer(started, { type: 'crocPick', seatId: 'p1', word: word('camel') });
  if (picked?.game !== 'croc') {
    throw new Error('not started');
  }
  return picked;
}

beforeEach(() => storage.clearAll());

describe('campfire-crocodile — engine (AC1, AC3)', () => {
  it('AC1: 3–15 players incl. the host; fewer or no packs start nothing', () => {
    expect(inRange('croc', 2)).toBe(false);
    expect(inRange('croc', 15)).toBe(true);
    expect(inRange('croc', 16)).toBe(false);
    expect(gameReducer(null, { type: 'startCroc', settings, seats: seats(2) })).toBeNull();
    expect(
      gameReducer(null, { type: 'startCroc', settings: { ...settings, packs: [] }, seats: seats(3) }),
    ).toBeNull();
    expect(gameReducer(null, { type: 'startCroc', settings, seats: seats(3) })).toMatchObject({
      phase: 'pick',
      turnNo: 0,
      durationSec: 60,
      totals: { guessed: 0, skipped: 0, turns: 0 },
    });
  });

  it('AC3: the public state never carries the word; stale turn or non-describer skips are ignored', () => {
    const state = ready();
    expect(toCrocPublic(state)).toEqual({
      phase: 'ready',
      turnNo: 1,
      durationSec: 60,
      totals: { guessed: 0, skipped: 0, turns: 0 },
      describerSeatId: 'p1',
    });
    const skip = { type: 'crocSkip' as const, round: 1, word: word('saiga') };
    expect(gameReducer(state, { ...skip, seatId: 'p1', turnNo: 0 })).toBe(state);
    expect(gameReducer(state, { ...skip, seatId: 'p2', turnNo: 1 })).toBe(state);
    expect(gameReducer(state, { ...skip, seatId: 'p1', turnNo: 1 })).toMatchObject({
      word: word('saiga'),
      totals: { skipped: 1 },
    });
  });

  it('AC3: words do not repeat within a pack until it is used up, then the pack starts over', () => {
    const pack = findCrocPack('croc-animals');
    if (!pack) {
      throw new Error('missing pack');
    }
    const drawn = Array.from({ length: 60 }, () => drawIds('croc', pack, 1, Math.random)[0]);
    expect(new Set(drawn).size).toBe(60);
    expect(readUsed('croc', 'croc-animals')).toHaveLength(60);
    drawIds('croc', pack, 1, Math.random);
    expect(readUsed('croc', 'croc-animals')).toHaveLength(1);
  });
});

describe('campfire-crocodile — packs and protocol (AC1, AC8)', () => {
  it('AC8: 3 packs × 60 words, unique ids, uz / ru / en on every word', () => {
    expect(crocPacks.map(pack => pack.id)).toEqual(['croc-animals', 'croc-heroes', 'croc-famous']);
    crocPacks.forEach(pack => {
      expect(pack.items).toHaveLength(60);
      expect(new Set(pack.items.map(item => item.id)).size).toBe(60);
    });
    const broken = { ...animalsRaw, items: animalsRaw.items.map(({ en: _en, ...rest }) => rest) };
    expect(parsePack(broken)).toBeNull();
  });

  it('AC1: protocol 5 carries the Crocodile messages and rejects a v3 phone', () => {
    expect(decodeClient('{"v":5,"type":"crocSkip","round":1,"turnNo":2}')).toEqual({
      ok: true,
      message: { v: 5, type: 'crocSkip', round: 1, turnNo: 2 },
    });
    expect(decodeClient('{"v":3,"type":"ping"}')).toEqual({ ok: false, reason: 'version' });
  });
});
