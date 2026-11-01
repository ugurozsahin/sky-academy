// #2317 (y6-longdiv): each why is the multiplication that checks the division, or names the remainder.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, '')));
const t = TOPICS.find(x => x.id === 'y6-longdiv')!;

describe('y6-longdiv whys (#2317)', () => {
  it('every card has a short why that is true of its sum', () => {
    const seen = { check: 0, full: 0, mixed: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!, m = nums(w);
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      if (/×/.test(w)) {
        seen.check++;
        const [quo, dv, prod, rem = 0] = m, n = nums(q.prompt)[0];
        expect(quo * dv, w).toBe(prod); expect(prod + rem, w).toBe(n);
        expect(rem).toBeLessThan(dv);
        expect(q.answer.startsWith(String(quo).replace(/\B(?=(\d{3})+$)/g, ',')) || q.answer.replace(/,/g, '').startsWith(String(quo)), w).toBe(true);
      } else if (/ are full/.test(w)) {
        seen.full++;
        const [quo, rem] = m, [n, dv] = nums(q.prompt);
        expect(quo * dv + rem, w).toBe(n);
        expect(Number(q.answer.replace(/,/g, ''))).toBe(/one more/.test(w) ? quo + 1 : quo);
      } else {
        seen.mixed++;
        const [quo, rem, a, b] = m, [n, dv] = nums(q.prompt);
        expect(quo * dv + rem, w).toBe(n);
        expect(q.answer.startsWith(`${quo} `), w).toBe(true);
        if (/simplifies/.test(w)) { expect(a).toBe(rem); expect(b).toBe(dv); }
      }
    }
    expect(seen.check).toBeGreaterThan(0); expect(seen.full).toBeGreaterThan(0); expect(seen.mixed).toBeGreaterThan(0);
  });
});
