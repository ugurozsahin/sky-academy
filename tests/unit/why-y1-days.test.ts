// #2318 (y1-days): every draw says days of the week start with a capital letter.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y1-days')!.gen;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

describe('y1-days says why (#2318)', () => {
  it('every draw names its day, is short and is not the bare answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      const day = DAYS.find(k => q.why!.startsWith(`${k}: `))!;
      expect(day, q.why).toBeTruthy();
      expect(q.why).toBe(`${day}: days start with a capital letter.`);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
