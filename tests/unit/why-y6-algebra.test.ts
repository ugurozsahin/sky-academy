// #2317 (y6-algebra): the why shows the inverse step, the two steps in order, or the angle or perimeter sum.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y6-algebra')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y6-algebra why (#2317)', () => {
  it('every question has a short why that ends in the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer.replace(/\D/g, '')}.`), q.why).toBe(true);
    }
  });
  it('d1 undoes the one step with its inverse', () => {
    for (const q of draw(1)) expect(q.why, q.prompt).toMatch(/^\d+ [−+×÷] \d+ = \d+\.$/);
  });
  it('d2 undoes the add or take-away, then divides', () => {
    for (const q of draw(2)) expect(q.why, q.prompt).toMatch(/^\d+ [−+] \d+ = \d+, then \d+ ÷ \d+ = \d+\.$/);
  });
});
