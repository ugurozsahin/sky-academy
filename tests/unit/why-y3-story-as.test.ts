// #2318: y3-story-as says why: the number sentence of each step the story tells.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y3-story-as')!.gen;

describe('y3-story-as says why (#2318)', () => {
  it('gives one sentence per step, the last one ending in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const parts = q.why!.split(', then ');
      expect(parts.length).toBe(d === 3 ? 2 : 1);
      for (const p of parts) expect(p).toMatch(/^\d+ [+-] \d+ = \d+$/);
      expect(parts[parts.length - 1].split(' = ')[1]).toBe(q.answer.replace(/\D/g, ''));
      expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
