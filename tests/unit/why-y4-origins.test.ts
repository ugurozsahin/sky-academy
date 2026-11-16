// #2318 (y4-origins): every draw names the whole word and the origin rule behind its spelling, and is not the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y4-origins')!.gen;

describe('y4-origins says why (#2318)', () => {
  it('every draw gives the whole word and its origin rule, in few words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      expect(q.why, `d${d}`).toMatch(/^[a-z]+: (Greek: ch says k|French: ch says sh|French: gue and que end the word|Latin: sc says s|ei, eigh and ey say ay)\.$/);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(10);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
