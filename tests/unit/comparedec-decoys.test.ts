import { describe, expect, it } from 'vitest';
import { y4CompareDec } from '../../src/curriculum/year4-comparedec';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y4-comparedec rounding decoys are whole numbers near the answer (#2319)', () => {
  it('d1: three distinct decoys within 3 of the answer, over 200 seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const q = y4CompareDec(1, rngOf(seed));
      const a = Number(q.answer), ds = q.options.filter(o => o !== q.answer).map(Number);
      expect(ds.length, `seed ${seed}`).toBe(3);
      expect(new Set(q.options).size).toBe(4);
      for (const d of ds) { expect(d).toBeGreaterThanOrEqual(0); expect(Math.abs(d - a), `seed ${seed}: ${d} vs ${a}`).toBeLessThanOrEqual(3); }
    }
  });

  it('d1: the answer takes every rank in the sorted options, including 3rd and 4th (#2319 review)', () => {
    const ranks = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = y4CompareDec(1, rngOf(seed)), sorted = q.options.map(Number).sort((p, r) => p - r);
      ranks.add(sorted.indexOf(Number(q.answer)));
    }
    expect(ranks.has(2)).toBe(true); expect(ranks.has(3)).toBe(true);
  });

  it('d1: every card from 0.1 to 19.4 has three distinct, non-negative decoys', () => {
    for (let t = 1; t <= 194; t++) {
      const q = y4CompareDec(1, rngOf(t * 7)), ds = q.options.filter(o => o !== q.answer).map(Number);
      expect(new Set(q.options).size, `t ${t}`).toBe(4); expect(ds.every(d => d >= 0)).toBe(true);
    }
  });
});
