import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { WORDS, groups } from '../../src/curriculum/year3-dictionary';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-dictionary')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1113 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const LEVEL: Record<Difficulty, number> = { 1: 2, 2: 3, 3: 4 };

describe('y3-dictionary (#1113)', () => {
  it('is registered once in Year 3 writing, spelling strand, sequencing from d1', () => {
    expect(TOPICS.filter(t => t.id === 'y3-dictionary')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', strand: 'spelling', sequenceFrom: 1 });
  });

  it('bank: lower case, ≤8 letters, no duplicates, no crude words, ≥8 groups at every level', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
    for (const w of WORDS) { expect(w).toMatch(/^[a-z]{2,8}$/); expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE, w).not.toContain(w); }
    for (const n of [2, 3, 4]) expect(groups(n).length, `level ${n}`).toBeGreaterThanOrEqual(8);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: words share their first ${LEVEL[d] - 1} letters, differ at letter ${LEVEL[d]}, and the sequence is alphabetical`, () => {
      const n = LEVEL[d];
      for (const q of draws(d)) {
        const w = q.sequence!;
        expect(w.length).toBeGreaterThanOrEqual(3);
        expect(w.length).toBeLessThanOrEqual(d === 3 ? 4 : 3);
        for (const x of w) expect(x.length, x).toBeGreaterThanOrEqual(n);
        expect(new Set(w.map(x => x.slice(0, n - 1))).size, w.join()).toBe(1);
        expect(new Set(w.map(x => x[n - 1])).size, w.join()).toBe(w.length);
        expect(w).toEqual([...w].sort((a, b) => a.localeCompare(b, 'en')));
        expect(q.answer).toBe(w.join(' '));
        expect([...q.options].sort()).toEqual([...w].sort());
        expect(q.anyOrder).toBeUndefined();
      }
    });
  }

  it('d3 draws four-word cards as well as three', () => {
    expect(new Set(draws(3, 300).map(q => q.sequence!.length))).toEqual(new Set([3, 4]));
  });

  it('every label passes R-LBL (#1046)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100))
      expect(rLblProblem(q as { options: string[] }), q.prompt).toBeNull();
  });
});
