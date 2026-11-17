// #2318: y3-check and y4-mistake say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('y3-check says why (#2318)', () => {
  it.each([1, 2, 3] as const)('the why is true arithmetic at difficulty %i', d => {
    for (let s = 1; s <= 200; s++) {
      const w = gen('y3-check')(d, rngOf(s)).why!;
      expect(w.length).toBeLessThanOrEqual(80);
      let m = w.match(/^\d+ is near (\d+) and \d+ is near (\d+): \d+ ([+−]) \d+ = (\d+)\.$/);
      if (m) { expect(m[3] === '+' ? +m[1] + +m[2] : +m[1] - +m[2]).toBe(+m[4]); continue; }
      m = w.match(/^Take away one part: (\d+) − (\d+) = (\d+), the other part\.$/) ?? w.match(/^Add back what you took: (\d+) \+ (\d+) = (\d+)\.$/);
      expect(m, w).not.toBeNull();
      expect(w.startsWith('Take') ? +m![1] - +m![2] : +m![1] + +m![2]).toBe(+m![3]);
    }
  });
});

describe('y4-mistake says why (#2318)', () => {
  it.each([1, 2, 3] as const)('names the column the answer points at, difficulty %i', d => {
    for (let s = 1; s <= 200; s++) {
      const q = gen('y4-mistake')(d, rngOf(s));
      expect(q.why, 'why').toMatch(/column/);
      expect(q.why!.length).toBeLessThanOrEqual(90);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
