// #2317 (y2-stats): the why shows the sum, the difference or the winner.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y2-stats')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y2-stats why (#2317)', () => {
  it('is set and short at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
    }
  });
  it('shows the working', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const rows = (q.visual as { rows: { n: number }[] }).rows.map(r => r.n);
      expect(q.why, q.prompt).toMatch(/\d/);
      if (/altogether/.test(q.prompt)) expect(q.why).toBe(`${rows.join(' + ')} = ${q.answer}.`);
      if (/most/.test(q.prompt)) expect(q.why).toContain(String(Math.max(...rows)));
    }
  });
});
