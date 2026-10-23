import { describe, it, expect } from 'vitest';
import { y2Position } from '../../src/curriculum/year2';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y2-position draws the turn it asks about (#2271)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`difficulty ${d}: every question carries a geometry visual`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const q = y2Position(d, rng(seed));
        expect(q.visual?.type, q.prompt).toBe('geometry');
      }
    });
  }
});
