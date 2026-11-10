// #2317 (y2-shapes): every card says why — what makes the solid itself, or the count that was asked.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-shapes and y1-shapes3d whys (#2317)', () => {
  it('each why is short and agrees with the answer', () => {
    const t = TOPICS.find(x => x.id === 'y2-shapes')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(10);
      if (q.prompt.startsWith('How many')) expect(w).toContain(` ${q.answer} `);
    }
  });
});
