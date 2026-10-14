import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y1_COMPOUNDS } from '../../src/curriculum/year1-compound';
import { ER_BANK, COMPOUND_BANK } from '../../src/curriculum/year2-nouns';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y2-nouns')!;
const DRAWS = 300;
const hasAvoid = (w: string) => [...AVOID].some(a => w.includes(a));

/** #1008: nouns made with -er and by compounding. */
describe('y2-nouns (#1008)', () => {
  it('-er rows: one gap, three decoys that are the same root\'s other forms, answer is root + er', () => {
    expect(ER_BANK.length).toBeGreaterThanOrEqual(9);
    for (const [root, s, decoys] of ER_BANK) {
      expect(s).toMatch(/^[^_]*___[^_]*$/);
      expect(decoys).toHaveLength(3);
      expect(new Set(decoys).size).toBe(3);
      for (const x of decoys) { expect(x, s).not.toBe(root + 'er'); expect(x.startsWith(root) || ['taught', 'sang', 'built'].includes(x), `${x} is not a form of ${root}`).toBe(true); }
      expect(hasAvoid(root + 'er'), root).toBe(false);
    }
  });
  it('compound rows: first + answer is the real word, no decoy joins the first word or hides an AVOID entry', () => {
    expect(COMPOUND_BANK.length).toBeGreaterThanOrEqual(10);
    for (const [first, second, s, decoys] of COMPOUND_BANK) {
      expect(s).toMatch(new RegExp(`${first}___`));
      expect(decoys).toHaveLength(3);
      expect(new Set([second, ...decoys]).size).toBe(4);
      for (const o of [second, ...decoys]) expect(hasAvoid(first + o), `${first}${o}`).toBe(false);
    }
  });
  it('no compound repeats a Year 1 compound-word entry', () => {
    const y1 = new Set(Y1_COMPOUNDS.map(([a, b]) => a + b));
    for (const [first, second] of COMPOUND_BANK) expect(y1.has(first + second), first + second).toBe(false);
  });
  it('follows the ladder: d1 -er with 3 bubbles, d2 -er with 4, d3 mixed with 4', () => {
    const ers = new Set(ER_BANK.map(r => r[0] + 'er'));
    const seenCompound = { 1: false, 2: false, 3: false };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10080 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options.length).toBe(d === 1 ? 3 : 4);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        const isEr = ers.has(q.answer);
        if (!isEr) seenCompound[d] = true;
        if (isEr) {
          const row = ER_BANK.find(x => x[1] === q.prompt)!;
          expect(row[0] + 'er').toBe(q.answer);
          for (const o of q.options) expect(o === q.answer || row[2].includes(o), o).toBe(true);
        } else {
          const row = COMPOUND_BANK.find(x => x[2] === q.prompt)!;
          expect(row[1]).toBe(q.answer);
          for (const o of q.options) expect(o === q.answer || row[3].includes(o), o).toBe(true);
        }
      }
    }
    expect(seenCompound).toEqual({ 1: false, 2: false, 3: true });
  });
  it('every card has a sentence visual and a say that reads the gap as "blank"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10090 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.visual?.type).toBe('sentence');
        expect(q.say).toContain('blank');
        expect(q.say).not.toContain('___');
      }
    }
  });
});
