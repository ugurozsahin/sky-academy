// #2317 (dividing decimals): each why turns the remainder into a decimal, or divides hundredths for a 1 dp dividend.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-decdiv')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y6-decdiv whys (#2317)', () => {
  it('a whole dividend shows quotient, remainder and the remainder as a decimal, ending in the answer', () => {
    let whole = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^([\d,]+) ÷ (\d+) = (\d+) r (\d+); (\d+) ÷ (\d+) = ([\d.]+): ([\d.]+)$/.exec(q.why!);
      if (!m) continue;
      whole++;
      const n = Number(m[1].replace(/,/g, '')), k = Number(m[2]);
      expect(Number(m[3]) * k + Number(m[4]), q.why).toBe(n);
      expect(m[5], q.why).toBe(m[4]);
      expect(m[6], q.why).toBe(m[2]);
      expect(Number(m[3]) + Number(m[7]), q.why).toBeCloseTo(Number(q.answer), 6);
      expect(m[8], q.why).toBe(q.answer);
    }
    expect(whole).toBeGreaterThan(300);
  });
  it('a 1 dp dividend divides hundredths and ends in the answer', () => {
    const tenths = draws(2).filter(q => /hundredths/.test(q.why!));
    expect(tenths.length).toBeGreaterThan(10);
    for (const q of tenths) {
      const m = /^(\d+) hundredths ÷ (\d+) = (\d+) hundredths: ([\d.]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(Number(m[1]) / Number(m[2])).toBe(Number(m[3]));
      expect(Number(m[3]) / 100).toBeCloseTo(Number(m[4]), 6);
      expect(m[4]).toBe(q.answer);
    }
  });
});
