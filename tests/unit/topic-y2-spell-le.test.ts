import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { LE_BANK, EL_BANK, AL_BANK, IL_BANK } from '../../src/curriculum/year2-spell-le';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-le')!;
const BANK = [...LE_BANK, ...EL_BANK, ...AL_BANK, ...IL_BANK];
const NO_HOMOPHONE = ['pedal', 'medal', 'metal', 'petal', 'idle', 'bridle'];
const ENDING = { le: LE_BANK, el: EL_BANK, al: AL_BANK, il: IL_BANK };

describe('y2-spell-le (#1010)', () => {
  it('sits directly after y2-spell-kn in the registry', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-le')).toBe(ids.indexOf('y2-spell-kn') + 1);
  });

  it('the answer is the bank word and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its own sentence`).toBe(false);
      expect(decoys.length, word).toBeGreaterThanOrEqual(3);
      
      expect(homophones.has(word) || NO_HOMOPHONE.includes(word), `${word} has a common homophone`).toBe(false);
      for (const dc of decoys) {
        expect(dc, `${word}: decoy repeats the answer`).not.toBe(word);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
      for (const [e, bank] of Object.entries(ENDING)) if (bank.some(r => r[0] === word)) {
        expect(word.endsWith(e), `${word} ends -${e}`).toBe(true);
        const stem = word.slice(0, -e.length);
        expect([...decoys].sort(), `${word}: decoys are the stem with the other three endings`).toEqual(['le', 'el', 'al', 'il'].filter(x => x !== e).map(x => stem + x).sort());
      }
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
    }
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual(PINNED);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('builds the ladder: -le with 3 bubbles, then -el with 4, then -al and -il, each card with a sentence and a say', () => {
    const banks = (d: Difficulty) => d === 1 ? [LE_BANK] : d === 2 ? [LE_BANK, EL_BANK] : [LE_BANK, EL_BANK, AL_BANK, IL_BANK];
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 600; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const bank = banks(d).find(b => b.some(r => r[0] === q.answer));
      expect(bank, `${q.answer} not allowed at d${d}`).toBeDefined();
      seen[d].add(q.answer.slice(-2));
      expect(q.options.length).toBe(d === 1 ? 3 : 4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
      expect(q.say).toContain(q.answer);
      expect(q.say).toContain('blank');
      const row = BANK.find(r => r[0] === q.answer)!;
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
    }
    expect([...seen[1]]).toEqual(['le']);
    expect([...seen[2]].sort()).toEqual(['el', 'le']);
    expect([...seen[3]].sort()).toEqual(['al', 'el', 'il', 'le']);
  });
});

const PINNED = [
  'animal', 'animel', 'animil', 'animle', 'bottal', 'bottel', 'bottil', 'bottle', 'camal', 'camel', 'camil', 'camle', 'candal', 'candel',
  'candil', 'candle', 'final', 'finel', 'finil', 'finle', 'fossal', 'fossel', 'fossil', 'fossle', 'hospital', 'hospitel', 'hospitil',
  'hospitle', 'littal', 'littel', 'littil', 'little', 'middal', 'middel', 'middil', 'middle', 'nostral', 'nostrel', 'nostril', 'nostrle',
  'pencal', 'pencel', 'pencil', 'pencle', 'puzzal', 'puzzel', 'puzzil', 'puzzle', 'signal', 'signel', 'signil', 'signle', 'squirral',
  'squirrel', 'squirril', 'squirrle', 'tabal', 'tabel', 'tabil', 'table', 'tinsal', 'tinsel', 'tinsil', 'tinsle', 'towal', 'towel', 'towil',
  'towle', 'traval', 'travel', 'travil', 'travle', 'tunnal', 'tunnel', 'tunnil', 'tunnle'
];
