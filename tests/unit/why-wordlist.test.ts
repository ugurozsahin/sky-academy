// #2318 (statutory word lists): every dictation card says its word in the order it is built, and is not the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe.each(['y3-wordlist', 'y4-wordlist', 'y5-wordlist', 'y6-wordlist'])('%s says why (#2318)', id => {
  const gen = TOPICS.find(x => x.id === id)!.gen;
  it('every draw has a short why that joins back to the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      const m = q.why!.match(/^(?:Letters|Parts) in order: (.+)$/);
      expect(m, q.why).not.toBeNull();
      expect(m![1].replace(/-/g, '')).toBe(q.answer);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
