// #2317 (geometry): y5-polygons, y5-transform and y6-transform say why on every card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('regular polygons and transformations whys (#2317)', () => {
  for (const id of ['y5-polygons', 'y5-transform', 'y6-transform']) {
    it(`${id}: a short why on every question`, () => {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      }
    });
  }
  it('a polygon why agrees with its answer: a Yes says everything is equal, a No names what is not', () => {
    const t = TOPICS.find(x => x.id === 'y5-polygons')!;
    for (const d of [1, 2] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf(s + 1));
      if (q.answer === 'Yes') expect(q.why).toBe('All its sides and all its angles are equal.');
      else expect(q.why).toMatch(/not|Neither/);
    }
  });
  it('a y6 point move names where the point lands', () => {
    const t = TOPICS.find(x => x.id === 'y6-transform')!;
    for (let s = 0; s < 200; s++) { const q = t.gen(1, rngOf(s + 1)); expect(q.why).toContain(q.answer); }
  });
});
