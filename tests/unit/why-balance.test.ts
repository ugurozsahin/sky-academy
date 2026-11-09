// #2317 (r-balance, y1-balance, y2-balance): the why writes the equation with the answer filled in.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const val = (side: string): number => {
  const m = side.trim().match(/^(\d+)(?:\s*([+−×])\s*(\d+))?$/)!;
  const a = +m[1], b = +(m[3] ?? 0);
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a;
};

describe('Balance the Scales why (#2317)', () => {
  for (const id of ['r-balance', 'y1-balance', 'y2-balance']) {
    it(`${id}: the why is the prompt with the answer filled in, and both sides are equal`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 7919 + d));
        expect(q.why, q.prompt).toBe(q.prompt.replace('?', q.answer));
        const [l, r] = q.why!.split(' = ');
        expect(val(l), q.why).toBe(val(r));
        expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
      }
    });
  }
});
