// #2318 (y1-spelling): every draw names the tricky letter of the word, and is not the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y1-spelling')!.gen;

describe('y1-spelling says why (#2318)', () => {
  it('every draw has a short why naming the tricky letter', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      expect(q.why, `d${d}`).toMatch(/^\w+: the tricky letter is "\w"\.$/);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
