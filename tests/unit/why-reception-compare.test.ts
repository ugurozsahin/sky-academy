// #2317 (Reception): r-compare, r-measure, r-patterns and r-shapes say why on every card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('Reception compare, measure, pattern and shape whys (#2317)', () => {
  for (const id of ['r-compare', 'r-measure', 'r-patterns', 'r-shapes']) {
    it(`${id}: a short why on every question`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      }
    });
  }
  it('r-compare names the answer and the other number', () => {
    const t = TOPICS.find(x => x.id === 'r-compare')!;
    for (let s = 0; s < 200; s++) {
      const q = t.gen(1, rngOf(s + 1));
      expect(q.why).toMatch(new RegExp(`^${q.answer} is (more|fewer) than \\d+\\.$`));
    }
  });
});
