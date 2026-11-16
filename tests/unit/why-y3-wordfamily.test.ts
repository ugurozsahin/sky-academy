// #2318 (y3-wordfamily): every draw says which root the answer, or the odd one out, comes from.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { FAMILIES } from '../../src/curriculum/year3-wordfamily';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y3-wordfamily')!.gen;
const roots = FAMILIES.map(f => f[0]);

describe('y3-wordfamily says why (#2318)', () => {
  it('every draw has a short why that names a root and is not the bare answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      expect(q.why, `d${d}`).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
      expect(roots.some(r => q.why!.includes(r)), q.why).toBe(true);
    }
  });
  it('the odd-one-out why names a root other than the one asked', () => {
    for (let n = 0; n < 200; n++) {
      const q = gen(2, rngOf(n + 1));
      const asked = /the (\w+) family/.exec(q.prompt)![1];
      expect(q.why).toMatch(new RegExp(`not ${asked}\\.$`));
    }
  });
});
