import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { HOMOPHONE_SETS } from '../../src/curriculum/year2';
import { REAL_LOOKALIKES } from '../../src/curriculum/spelling-rules';
import { KN_BANK, WR_BANK, GN_BANK } from '../../src/curriculum/year2-spell-kn';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y2-spell-kn')!;
const BANK = [...KN_BANK, ...WR_BANK, ...GN_BANK];
const NO_HOMOPHONE = ['know', 'knew', 'knight', 'knot', 'knit', 'knows', 'gnaw', 'write', 'wrote', 'wrap', 'wring'];

describe('y2-spell-kn (#1009)', () => {
  it('sits beside y2-homophones in the registry', () => {
    const ids = TOPICS.filter(t => t.year === 'year2').map(t => t.id);
    expect(ids.indexOf('y2-spell-kn')).toBe(ids.indexOf('y2-homophones') + 1);
  });

  it('the answer is the bank word and every decoy is a non-word, over the whole bank', () => {
    const homophones = new Set(HOMOPHONE_SETS.flat());
    for (const [word, sentence, decoys] of BANK) {
      expect(sentence, word).toContain('___');
      expect(decoys.length, word).toBeGreaterThanOrEqual(3);
      expect(/^(kn|wr|gn)/.test(word), `${word} starts with a silent letter pair`).toBe(true);
      expect(homophones.has(word) || NO_HOMOPHONE.includes(word), `${word} has a common homophone`).toBe(false);
      for (const dc of decoys) {
        expect(dc, `${word}: decoy repeats the answer`).not.toBe(word);
        expect(GAP_WORDS.has(dc) || AVOID.has(dc) || REAL_LOOKALIKES.has(dc) || homophones.has(dc), `${dc} is a real word`).toBe(false);
        for (const a of AVOID) expect(dc.includes(a), `${dc} contains ${a}`).toBe(false);
      }
      expect(new Set(decoys).size, `${word}: duplicate decoys`).toBe(decoys.length);
    }
  });

  it('pins every answer and decoy a card can show, sorted, so a change arrives in a diff (#418)', () => {
    const all = BANK.flatMap(([w, , ds]) => [w, ...ds]).sort();
    expect(all).toEqual([
      'gnaat', 'gnat', 'gnatt', 'gnee', 'gnoam', 'gnom', 'gnome', 'knat', 'kne', 'knea', 'kneal', 'knee', 'kneel', 'kneil', 'knif', 'knife', 'kniffe',
      'knoc', 'knock', 'knok', 'knome', 'knuckel', 'knuckle', 'knukle', 'nele', 'nife', 'nok', 'nuckle', 'rhen', 'riggle', 'rinkle', 'rist', 'rong',
      'wern', 'wren', 'wrenn', 'wrigel', 'wriggle', 'wrigle', 'wrinckle', 'wrinkel', 'wrinkle', 'wrisst', 'wrist', 'wriste', 'wrog', 'wrong', 'wronge',
    ]);
    expect(new Set(all).size, 'no spelling appears twice').toBe(all.length);
  });

  it('builds the ladder: kn with 3 bubbles, then wr with 4, then gn, each card with a sentence and a say', () => {
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 1; s <= 400; s++) {
      const q = topic.gen(d, rng(s * 7 + d));
      seen[d].add(q.answer.slice(0, 2));
      expect(q.options.length).toBe(d === 1 ? 3 : 4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.visual).toEqual({ type: 'sentence', text: expect.stringContaining('___') });
      expect(q.say).toContain(q.answer);
      expect(q.say).toContain('blank');
      const row = BANK.find(r => r[0] === q.answer)!;
      for (const o of q.options) if (o !== q.answer) expect(row[2]).toContain(o);
    }
    expect([...seen[1]]).toEqual(['kn']);
    expect([...seen[2]].sort()).toEqual(['kn', 'wr']);
    expect([...seen[3]].sort()).toEqual(['gn', 'kn', 'wr']);
  });
});
