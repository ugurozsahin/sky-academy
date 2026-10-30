import { describe, expect, it } from 'vitest';
import { y2Sub, subSlips } from '../../src/curriculum/year2/number';
import type { Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-sub decoys are subtraction slips (#2319)', () => {
  it('52 − 17: the borrow slip 45 is offered, never the answer', () => {
    expect(subSlips(52, 17)).toContain(45);
    expect(subSlips(52, 17)).not.toContain(35);
  });
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: every number card keeps a unique, in-range option set, over 300 seeds`, () => {
      let slipCards = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const q = y2Sub(d, rngOf(seed));
        if (q.options.length < 4 || !q.options.includes(q.answer)) continue;   // a slice-the-digits card has no number options
        const m = /^(\d+) − (\d+) = \?$/.exec(q.prompt);
        if (!m) continue;
        const a = Number(m[1]), b = Number(m[2]);
        expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
        expect(q.options).toContain(String(a - b));
        if (subSlips(a, b).some(v => q.options.includes(String(v)))) slipCards++;
      }
      expect(slipCards).toBeGreaterThan(100);
    });
  }
});
