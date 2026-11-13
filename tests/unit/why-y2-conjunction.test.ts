// #2318 (y2-conjunction): the why names the joining word and its job.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { JOINER_WHY } from '../../src/curriculum/year2-conjunction';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-conjunction says why (#2318)', () => {
  it('the why starts with the answer word and matches its job, never the bare answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = TOPICS.find(x => x.id === 'y2-conjunction')!.gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).toBe(JOINER_WHY[q.answer as keyof typeof JOINER_WHY]);
      expect(q.why!.startsWith(q.answer + ' ')).toBe(true);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
