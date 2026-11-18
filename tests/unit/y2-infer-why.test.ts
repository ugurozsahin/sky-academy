import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { INFER_BANK, clueWhy, wordsOf } from '../../src/curriculum/year2-infer';
import type { Difficulty, Rng } from '../../src/curriculum';

const rng = (seed: number): Rng => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('y2-infer why (#2318)', () => {
  it('every bank item names a clue word that is in its sentence', () => {
    for (const item of INFER_BANK) {
      const why = clueWhy(item);
      expect(why, item[0]).toMatch(/^"[^"]+" is the clue: /);
      const clue = why.split('"')[1];
      expect(wordsOf(item[0]), item[0]).toContain(clue);
    }
  });
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the why ends in the answer and fits the KS1 eight-word limit`, () => {
      const t = TOPICS.find(x => x.id === 'y2-infer')!;
      const r = rng(2318 + d);
      for (let i = 0; i < 200; i++) {
        const q = t.gen(d, r);
        expect(q.why!.endsWith(q.answer), q.why).toBe(true);
        expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
      }
    });
  }
});
