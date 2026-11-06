// #2317 (y4-coords): the why says where the point is (along, up), the move's landing, or the corner's rule.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y4-coords')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y4-coords why (#2317)', () => {
  it('is set and short at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('d1 along/up agree with the answer pair; d2 names the landing; d3 names the letter', () => {
    for (const q of draw(1)) {
      const pair = /^\(\d+, \d+\)$/.test(q.answer) ? q.answer : /\((\d+, \d+)\)/.exec(q.prompt)![0];
      const [x, y] = pair.slice(1, -1).split(', ');
      expect(q.why).toContain(`${x} along and ${y} up`);
    }
    for (const q of draw(2)) expect(q.why).toContain(`lands on ${q.answer}.`);
    for (const q of draw(3)) expect(q.why).toMatch(new RegExp(`^${q.answer} is \\(`));
  });
});
