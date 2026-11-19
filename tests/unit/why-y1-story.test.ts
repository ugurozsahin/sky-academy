// #2318: y1-story says why: the number sentence the story tells, ending in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y1-story')!.gen;

describe('y1-story says why (#2318)', () => {
  it('every why is a true one-step sentence that matches the story and ends in the answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 300; s++) {
      const q = gen(d, rngOf(s));
      const why = q.why!;
      expect(why, `d${d} seed ${s}`).toBeTruthy();
      const m = why.match(/^(\d+) ([+−]) (\d+) = (\d+)$/)!;
      expect(m, why).not.toBeNull();
      const [a, b, r] = [Number(m[1]), Number(m[3]), Number(m[4])];
      expect(m[2] === '+' ? a + b : a - b, why).toBe(r);
      expect(String(r), why).toBe(q.answer);
      expect(q.prompt.startsWith(`${a} `), q.prompt).toBe(true);
      expect(why, why).not.toBe(q.answer);
    }
  });
});
