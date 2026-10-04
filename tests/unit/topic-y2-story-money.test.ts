import { describe, it, expect } from 'vitest';
import { y2StoryMoney } from '../../src/curriculum/year2-story-money';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const DRAWS = 300;
/** Pence in a printed amount: `35p` → 35, `£1` → 100. */
const pence = (s: string) => (s.includes('£') ? 100 : Number(s.replace('p', '')));
const amounts = (s: string) => (s.match(/£1|\d+p/g) ?? []).map(pence);

describe('y2-story-money (#996)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`d${d}: the answer is the sum, or the amount paid minus the sum, recomputed from the prompt`, () => {
      const rng = mulberry32(996 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = y2StoryMoney(d, rng);
        const got = amounts(q.prompt), ans = pence(q.answer);
        if (d === 1) expect(ans).toBe(got[0] + got[1]);
        else if (d === 2) expect(ans).toBe(got[0] - got[1]);
        else expect(ans).toBe(got[0] - got[1] - got[2]);
        expect(ans).toBeGreaterThan(0);
        expect(ans).toBeLessThanOrEqual(100);
        expect(q.prompt.length).toBeLessThanOrEqual(83);
        expect(q.say).toBeTruthy();
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.answer);
        for (const o of q.options) { expect(pence(o)).toBeGreaterThan(0); expect(pence(o)).toBeLessThanOrEqual(100); }
      }
    });
  }

  it('prints no decimal and speaks no mixed amount', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < DRAWS; i++) for (const d of [1, 2, 3] as const) {
      const q = y2StoryMoney(d, rng);
      for (const t of [q.prompt, q.answer, ...q.options, q.say ?? '']) expect(t).not.toMatch(/\d\.\d|pounds and/);
      expect(q.say).not.toMatch(/£|\d+p\b/);
    }
  });

  it('follows the ladder: multiples of 5p for change, and d3 offers the forgot-an-item decoy', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < DRAWS; i++) {
      const q2 = y2StoryMoney(2, rng);
      expect(amounts(q2.prompt)[1] % 5).toBe(0);
      const q3 = y2StoryMoney(3, rng);
      const [, p, q] = amounts(q3.prompt);
      expect(p % 5).toBe(0);
      const forgot = 100 - Math.max(p, q);
      if (forgot !== pence(q3.answer)) expect(q3.options.map(pence)).toContain(forgot);
    }
  });
});
