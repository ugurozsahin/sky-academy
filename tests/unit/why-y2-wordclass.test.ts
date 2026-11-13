// #2318 (y2-wordclass): the why gives the test for the class, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { CLASS_JOB } from '../../src/curriculum/year2-wordclass';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-wordclass says why (#2318)', () => {
  it('names the class job on single-word and any-order cards', () => {
    const jobs = Object.values(CLASS_JOB);
    let single = 0, many = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = TOPICS.find(x => x.id === 'y2-wordclass')!.gen(d, rngOf((n + 1) * 104729 + d));
      expect(jobs.some(j => q.why!.endsWith(j)), q.why).toBe(true);
      expect(q.why).not.toBe(q.answer);
      if (q.anyOrder) { many++; expect(q.why!.startsWith('A ')).toBe(true); }
      else { single++; expect(q.why!.startsWith(q.answer + ' ')).toBe(true); }
    }
    expect(single).toBeGreaterThan(0); expect(many).toBeGreaterThan(0);
  });
});
