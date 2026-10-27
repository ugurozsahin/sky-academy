// #2317 (y5-x10): each why says how far the digits move and ends on the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-x10')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y5-x10 whys (#2317)', () => {
  it('every question has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('a worked sum: the places match the power of ten, the direction matches the operation, the result is the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const w = /^Each digit moves (\d) places? (left|right): (.+) ([×÷]) ([\d,]+) = (.+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(w[2], q.why).toBe(w[4] === '×' ? 'left' : 'right');
      expect(num(w[5]), q.why).toBe(10 ** Number(w[1]));
      expect(w[6], q.why).toBe(q.answer);
      expect(q.prompt.startsWith(`${w[3]} ${w[4]} ${w[5]} =`), q.prompt).toBe(true);
      const exp = w[4] === '×' ? num(w[3]) * num(w[5]) : num(w[3]) / num(w[5]);
      expect(Math.abs(exp - num(w[6])), q.why).toBeLessThan(1e-6);
    }
    expect(seen).toBeGreaterThan(300);
  });
  it('the missing power: from and to are the sum\'s own numbers and the places are the answer', () => {
    let seen = 0;
    for (const q of draws(3)) {
      const w = /^(.+) to (.+) is (\d) places?, so (.+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(q.answer).toBe(w[4]);
      expect(10 ** Number(w[3])).toBe(num(w[4]));
      expect(q.prompt).toContain(w[1]);
      expect(q.prompt).toContain(w[2]);
    }
    expect(seen).toBeGreaterThan(20);
  });
});
