// #2317 (y1-shapes, y4-shapes): every card says why — what makes the flat shape, or the property that names the class.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y1-shapes and y4-shapes whys (#2317)', () => {
  it('y1-shapes: each why is short and names the shape or the side count asked', () => {
    const t = TOPICS.find(x => x.id === 'y1-shapes')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const name = /(?:a|has a) (\w+)\??$/.exec(q.prompt)?.[1];
      if (name) expect(w.toLowerCase()).toContain(name);
      if (q.prompt.startsWith('How many')) expect(w).toContain(` ${q.answer} sides`);
    }
  });
  it('y4-shapes: each why names the class and its property, and stays within the card rail', () => {
    const t = TOPICS.find(x => x.id === 'y4-shapes')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(12);
      if (d > 1) expect(w.startsWith(`${q.answer} is `), w).toBe(true);
      else expect(w, 'names the class the property means').toMatch(/ means an? [a-z -]+\.$/);
    }
  });
});
