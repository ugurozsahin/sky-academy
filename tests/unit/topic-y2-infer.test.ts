import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { CATEGORIES, INFER_BANK, cluedAnswers, decoyPool, wordsOf, type InferCategory } from '../../src/curriculum/year2-infer';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y2-infer')!;
const DRAWS = 200;
const cats = Object.keys(CATEGORIES) as InferCategory[];
const LADDER: Record<Difficulty, InferCategory[]> = { 1: ['feeling'], 2: ['feeling', 'weather', 'place'], 3: cats };

/** #1015: infer from a sentence. */
describe('y2-infer (#1015)', () => {
  it('is registered once, directly after y2-conjunction', () => {
    const ids = TOPICS.map(t => t.id);
    expect(ids.filter(i => i === 'y2-infer')).toHaveLength(1);
    expect(ids.indexOf('y2-infer')).toBe(ids.indexOf('y2-conjunction') + 1);
  });
  it('oracle 1: every sentence holds a clue word of its answer', () => {
    for (const [s, , c, a] of INFER_BANK) expect(cluedAnswers(s, c), s).toContain(a);
  });
  it('oracle 2: no sentence holds a clue word of any other answer in its category', () => {
    for (const [s, , c, a] of INFER_BANK) expect(cluedAnswers(s, c), s).toEqual([a]);
  });
  it('oracle 3: no clue word belongs to two answers of one category', () => {
    for (const c of cats) {
      const all = Object.values(CATEGORIES[c]).flat();
      expect(new Set(all).size, c).toBe(all.length);
    }
  });
  it('every item answer is in its category and every item has at least 3 possible decoys', () => {
    for (const item of INFER_BANK) {
      expect(Object.keys(CATEGORIES[item[2]]), item[0]).toContain(item[3]);
      expect(decoyPool(item).length, item[0]).toBeGreaterThanOrEqual(3);
    }
  });
  it('the bank is big enough: 40 items, 8 per category, short sentences and answers', () => {
    expect(INFER_BANK.length).toBeGreaterThanOrEqual(40);
    for (const c of cats) expect(INFER_BANK.filter(i => i[2] === c).length, c).toBeGreaterThanOrEqual(8);
    for (const [s, , c] of INFER_BANK) {
      expect(s.length, s).toBeLessThanOrEqual(60);
      for (const a of Object.keys(CATEGORIES[c])) expect(a.length, a).toBeLessThanOrEqual(20);
    }
  });
  it('asks nothing about the future or the time of day', () => {
    for (const [s, q] of INFER_BANK) {
      expect(q.toLowerCase(), s).not.toMatch(/\bnext\b|\bwill\b|time of day|\bmorning\b|\bnight\b|\bo'clock\b/);
    }
  });
  it('no word of a sentence, and no option, is in AVOID', () => {
    for (const [s, , c] of INFER_BANK) {
      for (const w of [...wordsOf(s), ...Object.keys(CATEGORIES[c])]) expect(AVOID.has(w), w).toBe(false);
    }
  });
  it('follows the ladder: d1 feeling with 3 bubbles, d2 adds weather and place with 4, d3 adds before with 4', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10150 + d);
      const seen = new Set<string>();
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const item = INFER_BANK.find(x => x[0] === (q.visual as { text: string }).text)!;
        seen.add(item[2]);
        expect(LADDER[d]).toContain(item[2]);
        expect(item[3]).toBe(q.answer);
        expect(q.prompt).toBe(item[1]);
        expect(q.options.length).toBe(d === 1 ? 3 : 4);
        expect(new Set(q.options).size).toBe(q.options.length);
        for (const o of q.options) expect(o === q.answer || decoyPool(item).includes(o), `${o} is not a legal decoy for "${item[0]}"`).toBe(true);
      }
      expect([...seen].sort()).toEqual([...LADDER[d]].sort());
    }
  });
  it('never offers a notDecoys answer as a bubble', () => {
    const marked = INFER_BANK.filter(i => i[4]?.length);
    expect(marked.length).toBeGreaterThan(0);
    for (const item of marked) for (const n of item[4]!) expect(decoyPool(item), item[0]).not.toContain(n);
  });
  it('every card has a sentence visual, a say that reads sentence then question, a hint and no emoji', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10160 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const text = (q.visual as { text: string }).text;
        expect(q.visual?.type).toBe('sentence');
        expect(q.say).toBe(`${text} ${q.prompt}`);
        expect(q.hint).toBe('Look for the clue');
        expect(`${text}${q.prompt}${q.options.join('')}`).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });
});
