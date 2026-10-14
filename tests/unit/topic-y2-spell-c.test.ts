import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { CE_BANK, CI_BANK, CY_BANK } from '../../src/curriculum/year2-spell-c';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-c')!;
const BANK = [...CE_BANK, ...CI_BANK, ...CY_BANK];

describe('y2-spell-c (#1012)', () => {
  it('sits directly after y2-spell-dge in the registry', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-c')).toBe(ids.indexOf('y2-spell-dge') + 1);
  });

  it('the answer is the bank word and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its own sentence`).toBe(false);
      expect(decoys.length, word).toBeGreaterThanOrEqual(3);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
      for (const dc of decoys) {
        expect(dc, `${word}: decoy repeats the answer`).not.toBe(word);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
    }
  });

  it('keeps the homophone words out, and the letter after each answer\'s c is e, i or y', () => {
    const words = BANK.map(r => r[0]);
    for (const w of ['cell', 'cent', 'cite', 'ceiling', 'cellar']) expect(words).not.toContain(w);
    for (const [word] of CE_BANK) expect(/c[e]/.test(word), word).toBe(true);
    for (const [word] of CI_BANK) expect(/c[i]/.test(word), word).toBe(true);
    for (const [word] of CY_BANK) expect(/c[y]/.test(word), word).toBe(true);
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual(PINNED);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('builds the ladder: ce at d1 (3 bubbles), adds ci at d2 (4), adds cy at d3 (4); each card with a sentence and a say', () => {
    const banks = (d: Difficulty) => d === 1 ? [CE_BANK] : d === 2 ? [CE_BANK, CI_BANK] : [CE_BANK, CI_BANK, CY_BANK];
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 600; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const bank = banks(d).find(b => b.some(r => r[0] === q.answer));
      expect(bank, `${q.answer} not allowed at d${d}`).toBeDefined();
      seen[d].add(bank === CE_BANK ? 'ce' : bank === CI_BANK ? 'ci' : 'cy');
      expect(q.options.length).toBe(d === 1 ? 3 : 4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
      expect(q.say).toContain(q.answer);
      expect(q.say).toContain('blank');
      const row = BANK.find(r => r[0] === q.answer)!;
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
    }
    expect([...seen[1]]).toEqual(['ce']);
    expect([...seen[2]].sort()).toEqual(['ce', 'ci']);
    expect([...seen[3]].sort()).toEqual(['ce', 'ci', 'cy']);
  });
});

const PINNED = [
  'cinema', 'circle', 'city', 'cycle', 'face', 'faice', 'fancy', 'fanscy', 'fanssy', 'fansy', 'fasce', 'fase',
  'ice', 'icy', 'isce', 'iscy', 'ise', 'iss', 'issy', 'isy', 'pencil', 'penscil', 'pensil', 'penssil',
  'place', 'plaise', 'plasce', 'plase', 'race', 'raice', 'rasce', 'rase', 'scinema', 'scircle', 'scity', 'scycle',
  'sinema', 'sircle', 'sity', 'space', 'spaise', 'spasce', 'spase', 'spicey', 'spicy', 'spiscy', 'spisy', 'ssinema',
  'ssircle', 'ssity', 'ssycle', 'sycle'
];
