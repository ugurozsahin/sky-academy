import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { SHORT_BANK, LONG_BANK } from '../../src/curriculum/year2-spell-tion';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-tion')!;
const BANK = [...SHORT_BANK, ...LONG_BANK];

describe('y2-spell-tion (#1013)', () => {
  it('sits directly after y2-spell-c in the registry', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-tion')).toBe(ids.indexOf('y2-spell-c') + 1);
  });

  it('the answer ends in -tion and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(word.endsWith('tion'), `${word} must end in -tion`).toBe(true);
      expect(sentence.split('___').length, `${word}: exactly one gap`).toBe(2);
      expect(sentence.toLowerCase().includes(word), `${word} leaks into its own sentence`).toBe(false);
      expect(decoys.length, word).toBe(3);
      expect(homophones.has(word), `${word} has a common homophone`).toBe(false);
      expect(AVOID.has(word) || GAP_WORDS.has(word), `${word} is crude or a gap word`).toBe(false);
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
      for (const dc of decoys) {
        expect(dc.endsWith('tion'), `${dc} must not end in -tion`).toBe(false);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
    }
  });

  it('keeps section and nation out', () => {
    const words = BANK.map(r => r[0]);
    for (const w of ['section', 'nation']) expect(words).not.toContain(w);
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual(PINNED);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('builds the ladder: short words at d1 (3 bubbles) and d2 (4), adds the longer words at d3 (4); each card with a sentence and a say', () => {
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 600; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      const isShort = SHORT_BANK.some(r => r[0] === q.answer);
      if (d < 3) expect(isShort, `${q.answer} not allowed at d${d}`).toBe(true);
      seen[d].add(isShort ? 'short' : 'long');
      expect(q.options.length).toBe(d === 1 ? 3 : 4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
      expect(q.say).toContain(q.answer);
      expect(q.say).toContain('blank');
      const row = BANK.find(r => r[0] === q.answer)!;
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
      if (d === 1) for (const o of q.options) if (o !== q.answer) expect(o).toMatch(/sion$|shin$/);
    }
    expect([...seen[1]]).toEqual(['short']);
    expect([...seen[2]]).toEqual(['short']);
    expect([...seen[3]].sort()).toEqual(['long', 'short']);
  });
});

const PINNED = [
  'acsion', 'action', 'akshin', 'akshon', 'capshin', 'capshon', 'capsion', 'caption', 'fiction', 'fikshin',
  'fikshon', 'fiksion', 'fracsion', 'fraction', 'frakshin', 'frakshon', 'loshin', 'loshon', 'losion', 'lotion',
  'menshin', 'menshon', 'mension', 'mention', 'moshin', 'moshon', 'mosion', 'motion', 'poshin', 'poshon', 'posion',
  'potion', 'stashin', 'stashon', 'stasion', 'station'
];
