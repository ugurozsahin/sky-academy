// #2317 (y3-line): the why counts the line's steps from its left end to the marked number.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const num = (s: string) => +s.replace(/,/g, '');
const draw = () => { const t = TOPICS.find(x => x.id === 'y3-line')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y3-line why (#2317)', () => {
  it('every why is the steps of the unit from the left end, landing on the answer', () => {
    for (const q of draw()) {
      const w = q.why!, v = q.visual as { from: number; step: number; mark: number };
      const m = /^(\d+) steps? of (\d+) from ([\d,]+): ([\d,]+)$/.exec(w);
      expect(m, w).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      expect(+m![2]).toBe(v.step);
      expect(num(m![3])).toBe(v.from);
      expect(num(m![3]) + +m![1] * +m![2]).toBe(num(q.answer));
      expect(num(m![4])).toBe(num(q.answer));
      expect(v.mark).toBe(num(q.answer));
    }
  });
});
