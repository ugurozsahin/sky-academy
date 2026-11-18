// #2318: y3-story says why: the one number sentence that solves the problem.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y3-story')!.gen;

describe('y3-story says why (#2318)', () => {
  it('gives a true × or ÷ sentence ending in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const m = q.why!.match(/^(\d+) ([×÷]) (\d+) = (\d+)$/);
      expect(m, q.why).not.toBeNull();
      const [x, y, z] = [Number(m![1]), Number(m![3]), Number(m![4])];
      expect(m![2] === '×' ? x * y : x / y, q.why).toBe(z);
      expect(z, q.why).toBe(Number(q.answer.replace(/[^\d]/g, '')));
    }
  });
});
