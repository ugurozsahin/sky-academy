// #2318 (y2-punct): the why gives the job of the mark asked for, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { Y2_PUNCT_WHY } from '../../src/curriculum/year2/sentences';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-punct says why (#2318)', () => {
  it('gives every mark its rule', () => {
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = TOPICS.find(x => x.id === 'y2-punct')!.gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).toBe(Y2_PUNCT_WHY[q.answer]);
      expect(q.why).not.toBe(q.answer);
      seen.add(q.answer);
    }
    expect(seen.has(',') && seen.has("'") && seen.has('.')).toBe(true);
  });
});
