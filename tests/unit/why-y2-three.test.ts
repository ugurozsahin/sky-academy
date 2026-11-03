// #2317 (y2-three): each why adds the first two, then the third on, true and consistent with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-three whys (#2317)', () => {
  it('every why is the two-step sum of the numbers shown', () => {
    const t = TOPICS.find(x => x.id === 'y2-three')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const m = /^(\d+)\+(\d+) = (\d+), (\d+)\+(\d+) = (\d+)$/.exec(w);
      expect(m, w).not.toBeNull();
      const [a, b, ab, ab2, c, tot] = m!.slice(1).map(Number);
      expect(a + b, w).toBe(ab);
      expect(ab2, w).toBe(ab);
      expect(ab + c, w).toBe(tot);
      expect(tot, w).toBe(Number(q.answer));
      expect(q.prompt, w).toBe(`${a} + ${b} + ${c} = ?`);
    }
  });
});
