// #2318 (y6-cohesion): every draw says what the linker does, or gives the sentence in full; never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y6-cohesion')!.gen;

describe('y6-cohesion says why (#2318)', () => {
  it('every draw has a short why that is not the bare answer', () => {
    const kinds = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      expect(q.why, `d${d}`).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
      kinds.add(q.why!.includes(': the second') ? 'linker' : 'ellipsis');
    }
    expect(kinds.size).toBe(2);
  });
});
