// #2317 (y2-duration): the why names the count, the minutes compared, or the end time.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y2-duration')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y2-duration why (#2317)', () => {
  it('is set and short at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
    }
  });
  it('a fact states the count, a comparison the minutes, an end time the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (q.prompt.startsWith('How many')) expect(q.why).toContain(q.answer);
      else if (q.prompt.startsWith('Which takes')) expect(q.why).toMatch(/^\d+ minutes is the (longer|shorter|longest|shortest)\.$/);
      else expect(q.why).toMatch(new RegExp(`^Add \\d+ minutes: ${q.answer}\\.$`));
    }
  });
});
