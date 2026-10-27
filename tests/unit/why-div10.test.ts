// #2317 (y4-div10): each why shows the digits moving right, or names the place the asked digit sits in.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-div10')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y4-div10 whys (#2317)', () => {
  it('every question has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('a sum: the places match the divisor and the why ends on the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const w = /^Each digit moves (\d) places? right: (\d+) ÷ (\d+) = (.+)$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(10 ** Number(w[1]), q.why).toBe(Number(w[3]));
      expect(w[4], q.why).toBe(q.answer);
      expect(q.prompt.startsWith(`${w[2]} ÷ ${w[3]} =`), q.prompt).toBe(true);
    }
    expect(seen).toBeGreaterThan(300);
  });
  it('a digit-value card: the why names the answer place and the digit', () => {
    let seen = 0;
    for (const q of draws(3)) {
      const w = /^(.+) has its (\d) in the (\w+) place$/.exec(q.why!);
      if (!w) continue;
      seen++;
      expect(w[3]).toBe(q.answer);
      expect(q.prompt).toContain(`= ${w[1]}.`);
      expect(q.prompt).toContain(`The ${w[2]} is worth`);
    }
    expect(seen).toBeGreaterThan(20);
  });
});
