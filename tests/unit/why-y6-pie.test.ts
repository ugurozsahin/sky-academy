// #2317 (y6-pie): the why names the biggest or smallest slice, the equal parts behind the fraction, or the one-part division.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y6-pie')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y6-pie why (#2317)', () => {
  it('every question has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('d1 names the answer slice as the biggest or smallest', () => {
    for (const q of draw(1)) expect(q.why).toBe(`${q.answer} has the ${q.prompt.includes('most') ? 'biggest' : 'smallest'} slice.`);
  });
  it('d2 counts the equal parts and ends in the answer when it simplifies', () => {
    for (const q of draw(2)) {
      expect(q.why, q.prompt).toMatch(/^\d+ of \d+ equal parts is \d+\/\d+(, which is \d+\/\d+)?\.$/);
      if (q.why!.includes('which is')) expect(q.why!.endsWith(`${q.answer}.`)).toBe(true);
      else expect(q.why).toContain(`is ${q.answer}.`);
    }
  });
  it('d3 divides the total into one part, then scales to the answer', () => {
    for (const q of draw(3)) {
      expect(q.why, q.prompt).toMatch(/^\d+ ÷ \d+ = \d+( for one part, so \d+ parts make \d+)?\.$/);
      expect(q.why!.endsWith(`${q.answer}.`)).toBe(true);
    }
  });
});
