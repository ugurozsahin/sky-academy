// #2317 (mean family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-mean')!.gen(d, rngOf((s + 1) * 104729 + d)));
const nums = (h: string) => h.match(/\d+/g)!.map(Number);

describe('y6-mean whys (#2317)', () => {
  it('a mean card says the real total divided by the real count, ending in the answer', () => {
    for (const q of [...draws(1), ...draws(2), ...draws(3).filter(q => q.prompt !== 'The missing number?')]) {
      const m = /^Total (\d+) ÷ (\d+) = (.+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const xs = nums(q.hint!.replace(/^[^:]*:/, ''));
      expect(Number(m[1]), q.why).toBe(xs.reduce((a, b) => a + b, 0));
      expect(Number(m[2]), q.why).toBe(xs.length);
      expect(m[3], q.why).toBe(q.answer);
    }
  });
  it('a missing-number card shows the full total and what is left once the known numbers go', () => {
    const qs = draws(3).filter(q => q.prompt === 'The missing number?');
    expect(qs.length).toBeGreaterThan(20);
    for (const q of qs) {
      const m = /^(\d+) × (\d+) = (\d+), minus (\d+) leaves (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [n, mean, total, known, left] = m.slice(1).map(Number);
      const [hm, hn, ...ks] = nums(q.hint!);
      expect([n, mean]).toEqual([hn, hm]);
      expect(n * mean, q.why).toBe(total);
      expect(ks.reduce((a, b) => a + b, 0), q.why).toBe(known);
      expect(total - known, q.why).toBe(left);
      expect(String(left), q.why).toBe(q.answer);
    }
  });
});
