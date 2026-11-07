// #2317 (y5-equals): the why shows the finished pan's total, which is the number the gap must make.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y5-equals')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y5-equals why (#2317)', () => {
  it('is set, short, and ends on the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`so the gap is ${q.answer}.`), q.why).toBe(true);
    }
  });
});
