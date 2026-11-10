// #2317 (y2-time): the why names the minute number the long hand points at, and the answer, in 8 words or fewer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('Year 2 time why (#2317)', () => {
  it('y2-time: the long-hand number matches the clock and the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-time')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d));
      const v = q.visual as { type: string; h: number; m: number };
      const w = q.why!;
      expect(w, q.answer).toBe(`Long hand on ${v.m === 0 ? 12 : v.m / 5}: ${q.answer}.`);
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
    }
  });
});
