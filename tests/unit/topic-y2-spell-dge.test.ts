import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { DGE_BANK, GE_BANK, G_BANK } from '../../src/curriculum/year2-spell-dge';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-dge')!;
const BANK = [...DGE_BANK, ...GE_BANK, ...G_BANK];

describe('y2-spell-dge (#1011)', () => {
  it('sits directly after y2-spell-le in the registry, before the rest of the spelling rules', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-dge')).toBe(ids.indexOf('y2-spell-le') + 1);
  });

  it('the answer is the bank word and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its own sentence`).toBe(false);
      expect(decoys.length, word).toBeGreaterThanOrEqual(2);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
      for (const dc of decoys) {
        expect(dc, `${word}: decoy repeats the answer`).not.toBe(word);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
    }
  });

  it('the -j spelling is a decoy on every end-of-word card, and the g cards offer the j spelling', () => {
    for (const [word, , decoys] of [...DGE_BANK, ...GE_BANK]) expect(decoys.some(x => x.endsWith('j')), `${word}: a -j decoy`).toBe(true);
    for (const [word] of DGE_BANK) expect(word.endsWith('dge'), word).toBe(true);
    for (const [word] of GE_BANK) expect(word.endsWith('ge') && !word.endsWith('dge'), word).toBe(true);
    for (const [word, , decoys] of G_BANK) expect(decoys.some(x => x.includes('j')), `${word}: j for g`).toBe(true);
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual(PINNED);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('builds the ladder: -dge, then -ge, then g before e, i and y; 3 bubbles, each card with a sentence and a say', () => {
    const banks = (d: Difficulty) => d === 1 ? [DGE_BANK] : d === 2 ? [DGE_BANK, GE_BANK] : [DGE_BANK, GE_BANK, G_BANK];
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 600; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const bank = banks(d).find(b => b.some(r => r[0] === q.answer));
      expect(bank, `${q.answer} not allowed at d${d}`).toBeDefined();
      seen[d].add(bank === DGE_BANK ? 'dge' : bank === GE_BANK ? 'ge' : 'g');
      expect(q.options.length).toBe(3);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
      expect(q.say).toContain(q.answer);
      expect(q.say).toContain('blank');
      const row = BANK.find(r => r[0] === q.answer)!;
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
    }
    expect([...seen[1]]).toEqual(['dge']);
    expect([...seen[2]].sort()).toEqual(['dge', 'ge']);
    expect([...seen[3]].sort()).toEqual(['dge', 'g', 'ge']);
  });
});

const PINNED = [
  'adge', 'age', 'aj', 'aje', 'badg', 'badge', 'badj', 'bage', 'bridg', 'bridge', 'bridj', 'brige',
  'cadg', 'cage', 'caj', 'caje', 'chandge', 'change', 'chanj', 'chanje', 'chardge', 'charge', 'charj', 'charje',
  'dodg', 'dodge', 'dodj', 'dodje', 'edg', 'edge', 'ege', 'ej', 'enerdgy', 'energy', 'enerjee', 'enerjy',
  'fudg', 'fudge', 'fudj', 'fuje', 'gem', 'gemm', 'giant', 'giraff', 'giraffe', 'giyant', 'hedg', 'hedge',
  'hedj', 'hege', 'hudge', 'huge', 'huj', 'huje', 'jem', 'jeme', 'jiant', 'jiraffe', 'jyant', 'jyraffe',
  'magic', 'magyc', 'majic', 'majyc', 'stadge', 'stage', 'staj', 'staje'
];
