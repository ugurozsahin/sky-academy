// #2317 (r-order, y1-order, y2-order): the why lists the numbers smallest to biggest.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('Order Up why (#2317)', () => {
  for (const id of ['r-order', 'y1-order', 'y2-order']) {
    it(`${id}: the why lists the answer numbers smallest to biggest`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 7919 + d));
        expect(q.why, q.prompt).toBe(`${q.answer.split(',').join(', ')}: smallest to biggest.`);
        const nums = q.answer.split(',').map(Number);
        expect(nums, q.why).toEqual([...nums].sort((a, b) => a - b));
        expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
      }
    });
  }
});
