// #2317 (y4-shortmult, y5-shortdiv): the why is the place-value split, or the multiplication that checks the division.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, '')));
const run = (id: string, each: (q: ReturnType<typeof TOPICS[0]['gen']>, w: string) => void) => {
  const t = TOPICS.find(x => x.id === id)!;
  for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
    const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
    expect(w, q.prompt).toBeTruthy();
    expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
    each(q, w);
  }
};

describe('y4-shortmult whys (#2317)', () => {
  it('splits the number by place value and multiplies each part', () => {
    run('y4-shortmult', (q, w) => {
      const [a, m] = nums(q.prompt), [whole, ...rest] = nums(w);
      expect(whole).toBe(a);
      const k = rest.length / 2, parts = rest.slice(0, k), prods = rest.slice(k);
      expect(parts.reduce((x, y) => x + y, 0), w).toBe(a);
      parts.forEach((p, i) => expect(p * m, w).toBe(prods[i]));
      expect(prods.reduce((x, y) => x + y, 0), w).toBe(Number(q.answer.replace(/,/g, '')));
    });
  });
});

describe('y5-shortdiv whys (#2317)', () => {
  it('is true of its sum', () => {
    const seen = { check: 0, full: 0 };
    run('y5-shortdiv', (q, w) => {
      const [n, dv] = nums(q.prompt);
      if (/×/.test(w)) {
        seen.check++;
        const [quo, d2, prod, rem = 0] = nums(w);
        expect(d2).toBe(dv); expect(quo * dv, w).toBe(prod); expect(prod + rem, w).toBe(n);
        expect(q.answer.startsWith(String(quo)), w).toBe(true);
      } else {
        seen.full++;
        const [quo, rem] = nums(w), [total, size] = nums(q.prompt);
        expect(quo * size + rem, w).toBe(total);
        expect(Number(q.answer.replace(/,/g, ''))).toBe(/one more/.test(w) ? quo + 1 : /full/.test(q.prompt) ? quo : rem);
      }
    });
    expect(seen.check).toBeGreaterThan(0); expect(seen.full).toBeGreaterThan(0);
  });
});
