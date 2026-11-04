// #2317 (y2-estimate): the why counts the steps of the line's own unit from 0 to the question mark.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-estimate why (#2317)', () => {
  it('every question has a short why whose steps multiply to the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-estimate')!;
    const units = new Set<number>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d));
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const m = /^(\d+) steps? of (\d+) from 0: (\d+)$/.exec(w);
      expect(m, w).toBeTruthy();
      const steps = +m![1], unit = +m![2];
      expect(steps * unit).toBe(+q.answer);
      expect(+m![3]).toBe(+q.answer);
      units.add(unit);
    }
    expect([...units].sort()).toEqual([1, 10]);
  });
});
