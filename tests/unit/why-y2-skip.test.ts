// #2317 (y2-skip): each why names the jump and moves the last number shown on by it, true and consistent with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-skip whys (#2317)', () => {
  it('every why is the jump applied to the last number shown', () => {
    const t = TOPICS.find(x => x.id === 'y2-skip')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const m = /^([+−])(\d+) each time: (\d+) ([+−]) (\d+) = (\d+)$/.exec(w);
      expect(m, w).not.toBeNull();
      const [jump, last, step, res] = [Number(m![2]), Number(m![3]), Number(m![5]), Number(m![6])];
      expect(m![4], w).toBe(m![1]);
      expect(step, w).toBe(jump);
      expect(m![1] === '+' ? last + step : last - step, w).toBe(res);
      expect(res, w).toBe(Number(q.answer));
      const shown = q.prompt.split(',').slice(0, -1).map(x => Number(x.trim()));
      expect(shown[shown.length - 1], w).toBe(last);
    }
  });
});
