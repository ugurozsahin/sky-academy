// #2317 (y6-fracdiv): each why divides the top or multiplies the bottom, and lands on the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-fracdiv')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-fracdiv whys (#2317)', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`difficulty ${d}: the working is true and ends on the answer`, () => {
      for (const q of draws(d)) {
        const why = q.why!;
        expect(why.split(/\s+/).length, why).toBeLessThanOrEqual(14);
        expect(why.endsWith(q.answer), why).toBe(true);
        const top = /^(\d+) ÷ (\d+) = (\d+), so /.exec(why);
        const bottom = /^(\d+) × (\d+) = (\d+): (\d+)\/(\d+)/.exec(why);
        expect(top ?? bottom, why).toBeTruthy();
        if (top) expect(Number(top[1]) / Number(top[2]), why).toBe(Number(top[3]));
        else {
          expect(Number(bottom![1]) * Number(bottom![2]), why).toBe(Number(bottom![3]));
          expect(bottom![5], why).toBe(bottom![3]);
        }
      }
    });
  }
});
