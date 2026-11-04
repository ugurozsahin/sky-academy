// #2317 (y1-line, y2-line): the why shows the hidden number between its two neighbours, counting in the line's own step.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('number line why (#2317)', () => {
  for (const id of ['y1-line', 'y2-line']) {
    it(`${id}: every question has a short why that matches its answer and step`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      const steps = new Set<number>();
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d));
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
        const m = /^Counting (?:on|in (\d+)s): (\d+), (\d+), (\d+)$/.exec(w);
        expect(m, w).toBeTruthy();
        const step = m![1] ? +m![1] : 1;
        expect(+m![3]).toBe(+q.answer);
        expect(+m![3] - +m![2]).toBe(step); expect(+m![4] - +m![3]).toBe(step);
        expect(q.visual).toMatchObject({ step });
        steps.add(step);
      }
      expect(steps.size).toBeGreaterThan(id === 'y1-line' ? 0 : 3);
    });
  }
});
