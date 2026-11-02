// #2317 (y2-equiv): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y2-equiv')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y2-equiv whys (#2317)', () => {
  it('every question has a short why that matches its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(12);
      const m = /^2\/4 is the same as 1\/2, so (\d+)$/.exec(q.why!);
      if (m) { expect(m[1], q.why).toBe(q.answer); continue; }
      const f = /^(\d\/\d) = (\d\/\d): 2 quarters make 1 half$/.exec(q.why!);
      expect(f, q.why).not.toBeNull();
      expect(new Set([f![1], f![2]])).toEqual(new Set(['1/2', '2/4']));
      expect(f![2], q.why).toBe(q.answer);
    }
  });
});
