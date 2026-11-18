// #2318: y5-story says why: the whole number sentence of the story, worked left to right.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y5-story')!.gen;
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y5-story says why (#2318)', () => {
  it('is a true left-to-right sum ending in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const [lhs, rhs] = q.why!.split(' = ');
      const t = lhs.split(' ');
      let v = num(t[0]);
      for (let i = 1; i < t.length; i += 2) v = t[i] === '+' ? v + num(t[i + 1]) : v - num(t[i + 1]);
      expect(v, q.why).toBe(num(rhs));
      expect(num(rhs), q.why).toBe(num(q.answer));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
