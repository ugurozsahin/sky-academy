// #2317 (y6-formulae): each why shows the substitution and its result, and the result is the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-formulae')!.gen(d, rngOf((s + 1) * 104729 + d)));
const last = (why: string) => why.split(/=\s*/).pop()!;

describe('y6-formulae whys (#2317)', () => {
  it('every card has a short why that ends on the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(last(q.why!), q.why).toBe(q.answer);
    }
  });
  it('d1 whys are one true sum', () => {
    for (const q of draws(1)) {
      const m = /^(\d+) ([×+−]) (\d+) = (\d+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      const [a, b, r] = [Number(m![1]), Number(m![3]), Number(m![4])];
      expect(m![2] === '×' ? a * b : m![2] === '+' ? a + b : a - b).toBe(r);
    }
  });
  it('d2 whys show the product, then the second step', () => {
    for (const q of draws(2)) {
      const m = /^(\d+) × (\d+) = (\d+), then ([+−]) (\d+) = (\d+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      const [a, n, p, , b, r] = m!.slice(1).map(x => (/\d/.test(x) ? Number(x) : 0));
      expect(a * n).toBe(p);
      expect(m![4] === '+' ? p + b : p - b).toBe(r);
    }
  });
  it('d3 whys substitute the numbers the card gave', () => {
    for (const q of draws(3)) {
      expect(q.why, q.prompt).toMatch(/^[\d ×+−()]+ = \d+$/);
      for (const n of q.why!.split('=')[0].match(/\d+/g)!) expect(q.prompt, q.why).toContain(`= ${n}`);
    }
  });
});
