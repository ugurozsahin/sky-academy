// #2317 (y4-mental): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-mental')!.gen(d, rngOf((s + 1) * 104729 + d)));
const n = (s: string) => Number(s.replace(/,/g, ''));

describe('y4-mental whys (#2317)', () => {
  it('every question carries a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
  it('d1: × 0 says 0; × 1 and ÷ 1 name the number unchanged', () => {
    for (const q of draws(1)) {
      if (q.answer === '0') expect(q.why).toBe('anything × 0 is 0');
      else expect(q.why, q.prompt).toMatch(/^[×÷] 1 changes nothing: ([\d,]+) [×÷] 1 = ([\d,]+)$/);
    }
  });
  it('d2: the table fact is true, the power of ten reaches the answer', () => {
    for (const q of draws(2)) {
      const m = /^(\d+) ([×÷]) (\d+) = (\d+), then × (\d+) = ([\d,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [a, b, p, k, r] = [n(m[1]), n(m[3]), n(m[4]), n(m[5]), n(m[6])];
      expect(m[2] === '×' ? a * b : a / b, q.why).toBe(p);
      expect(p * k, q.why).toBe(r);
      expect(String(r), q.why).toBe(q.answer.replace(/,/g, ''));
    }
  });
  it('d3: the stated product is of two numbers on the card and ends in the answer', () => {
    for (const q of draws(3)) {
      const m = /^(\d+) × (\d+) = (\d+); ([\d,]+) × (\d+) = ([\d,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const nums = q.prompt.replace(' = ?', '').split(' × ').map(n);
      expect(nums, q.why).toEqual(expect.arrayContaining([n(m[1]), n(m[2]), n(m[5])]));
      expect(n(m[1]) * n(m[2]), q.why).toBe(n(m[3]));
      expect(n(m[3]) * n(m[5]), q.why).toBe(n(m[6]));
      expect(String(n(m[6])), q.why).toBe(q.answer.replace(/,/g, ''));
    }
  });
});
