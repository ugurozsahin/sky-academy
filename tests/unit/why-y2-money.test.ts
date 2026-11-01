// #2317 (y2-money family): each why is the same sum in pence and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { coinLabel } from '../../src/curriculum/util';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y2-money')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y2-money whys (#2317)', () => {
  it('every question at every level has a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
  it('coin sums add up to the total in the why', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const m = /^(\d+)p(?: \+ (\d+)p)+ = (\d+)p$/.exec(q.why!)!;
      expect(m, q.why).not.toBeNull();
      const parts = q.why!.split(' = ')[0].split(' + ').map(x => parseInt(x));
      expect(parts.reduce((a, b) => a + b, 0), q.why).toBe(+m[3]);
      if (d === 1) expect(q.answer, q.why).toBe(coinLabel(+m[3]));
    }
  });
  it('change is taken from 100p and matches the answer', () => {
    for (const q of draws(3)) {
      const m = /^100p − (\d+)p = (\d+)p$/.exec(q.why!)!;
      expect(m, q.why).not.toBeNull();
      expect(100 - +m[1], q.why).toBe(+m[2]);
      expect(q.answer).toBe(`${m[2]}p`);
      expect(q.prompt).toBe(`Change from £1 for ${m[1]}p?`);
    }
  });
});
