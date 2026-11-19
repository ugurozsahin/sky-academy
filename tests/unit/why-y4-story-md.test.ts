// #2318: y4-story-md says why: the multiplication (and the add) as true arithmetic, ending in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y4-story-md')!.gen;
const num = (s: string) => Number(s.replace(/[£,]/g, ''));

describe('y4-story-md says why (#2318)', () => {
  it('every sentence is true arithmetic, short, and reaches the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 300; s++) {
      const q = gen(d, rngOf(s));
      const why = q.why!;
      expect(why, `d${d} seed ${s}`).toBeTruthy();
      expect(why.split(/\s+/).length, why).toBeLessThanOrEqual(16);
      const nums = why.match(/\d[\d,]*/g)!.map(num);
      // each "a × b = c" / "a + b = c" chain link is true
      for (const m of why.matchAll(/(\d[\d,]*) ([×+]) (\d[\d,]*) = (\d[\d,]*)/g)) {
        const [a, b, c] = [num(m[1]), num(m[3]), num(m[4])];
        expect(m[2] === '×' ? a * b : a + b, why).toBe(c);
      }
      const answer = num(q.answer.replace(/[^\d,]/g, ''));
      expect(nums, why).toContain(answer);
      expect(why, why).not.toBe(q.answer);
    }
  });
});
