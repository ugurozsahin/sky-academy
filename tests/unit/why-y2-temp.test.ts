// #2317 (y2-temp): the why names the temperature compared, or the estimate's value.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y2-temp')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y2-temp why (#2317)', () => {
  it('is set and short at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
    }
  });
  it('a comparison starts with its answer; an estimate states the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (q.prompt.startsWith('Which is')) {
        expect(q.why!.startsWith(q.answer + ' is ')).toBe(true);
        expect(q.why).toContain(q.prompt.includes('warmer') ? 'more than' : 'less than');
      } else expect(q.why).toContain(`about ${q.answer}.`);
    }
  });
});
