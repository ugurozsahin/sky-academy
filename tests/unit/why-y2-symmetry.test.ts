// #2317 (y2-symmetry): every card says why — halves match or not for the picture, the fold for letters.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { isVertSymmetric } from '../../src/curriculum/year2';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-symmetry whys (#2317)', () => {
  it('each why is short and agrees with the drawn picture', () => {
    const t = TOPICS.find(x => x.id === 'y2-symmetry')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const v = q.visual as { grid?: string[] } | undefined;
      if (v?.grid) {
        const yes = isVertSymmetric(v.grid);
        expect(q.answer).toBe(yes ? 'yes' : 'no');
        expect(w.startsWith(yes ? 'Both' : 'The two')).toBe(true);
      } else expect(w.startsWith('Fold it')).toBe(true);
    }
  });
});
