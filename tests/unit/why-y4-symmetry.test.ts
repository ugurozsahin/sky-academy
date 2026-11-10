// #2317 (y4-symmetry): every card says why — the fold for letters and counts, flip-not-slide for the missing square.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { symmetryLines } from '../../src/curriculum/year4-symmetry';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y4-symmetry whys (#2317)', () => {
  it('each why fits the card and the count why agrees with the drawn shape', () => {
    const t = TOPICS.find(x => x.id === 'y4-symmetry')!;
    const word = { 0: 'No', 1: 'One', 2: 'Two', 4: 'Four' } as Record<number, string>;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      if (d === 2) {
        const v = q.visual as { grid: string[] };
        expect(w.startsWith(word[symmetryLines(v.grid).total]), w).toBe(true);
        expect(String(symmetryLines(v.grid).total)).toBe(q.answer);
      }
    }
  });
});
