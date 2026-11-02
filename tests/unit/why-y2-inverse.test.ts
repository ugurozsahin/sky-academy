// #2317 (y2-inverse): each why is the inverse sum that finds the missing number, true, and consistent with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-inverse whys (#2317)', () => {
  it('every why is a true sum that uses the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-inverse')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const m = /^(\d+) ([+−]) (\d+) = (\d+)$/.exec(w);
      expect(m, w).not.toBeNull();
      const [x, y, z] = [Number(m![1]), Number(m![3]), Number(m![4])];
      expect(m![2] === '+' ? x + y : x - y, w).toBe(z);
      expect([x, y, z], w).toContain(Number(q.answer));
      expect(q.prompt.includes(String(x)) || q.prompt.includes(String(z)), w).toBe(true);
    }
  });
});
