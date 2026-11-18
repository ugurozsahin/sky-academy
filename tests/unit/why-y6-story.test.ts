// #2318: y6-story says why: the number sentence (d1–2, left to right) or the rounded sum (d3).
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y6-story')!.gen;
const num = (s: string) => Number(s.replace(/,/g, ''));
const apply = (v: number, op: string, n: number) => op === '+' ? v + n : op === '-' ? v - n : op === '×' ? v * n : v / n;

describe('y6-story says why (#2318)', () => {
  it('is a true sentence ending in the answer, short enough for the card', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const [lhs, rhs] = q.why!.split(' = ');
      const t = lhs.split(' ');
      let v = num(t[0]);
      for (let i = 1; i < t.length; i += 2) v = apply(v, t[i], num(t[i + 1]));
      expect(v, q.why).toBe(num(rhs));
      expect(num(rhs), q.why).toBe(num(q.answer));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
