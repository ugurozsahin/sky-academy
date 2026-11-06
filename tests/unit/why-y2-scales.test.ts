// #2317 (y2-scales): the why names the step size and the reading.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y2-scales')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y2-scales why (#2317)', () => {
  it('is set and short at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
    }
  });
  it('names the step and the reading', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const step = (q.visual as { step: number }).step, unit = q.answer.split(' ')[1];
      expect(q.why).toBe(`Each step is ${step} ${unit}: ${q.answer}.`);
    }
  });
});
