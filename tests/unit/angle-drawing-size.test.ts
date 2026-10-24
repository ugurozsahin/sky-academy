import { describe, it, expect } from 'vitest';
import { topicById, type Difficulty, type GeoPart } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// #2278: a lone angle was ~40 px across at 390 px wide. The svg is 220 px for 100 units, so an arm of 24 units is 53 px.
describe('a lone angle is drawn big enough to judge on a phone (#2278)', () => {
  for (const id of ['y3-angles', 'y4-angles', 'y5-angles']) {
    it(`${id}: every single-angle drawing has arms of at least 24 units, inside the box`, () => {
      const t = topicById(id)!, r = rng(2278);
      let seen = 0;
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 200; i++) {
        const v = t.gen(d, r).visual as { type: string; parts?: GeoPart[] } | undefined;
        const parts = v?.type === 'geometry' ? v.parts! : [];
        if (parts.length !== 1 || parts[0].kind !== 'angle') continue;
        const a = parts[0]; seen++;
        expect(a.len ?? 16).toBeGreaterThanOrEqual(24);
        for (const k of [a.dir, a.dir + a.deg]) {
          const x = a.at[0] + (a.len ?? 16) * Math.cos(k * Math.PI / 180), y = a.at[1] - (a.len ?? 16) * Math.sin(k * Math.PI / 180);
          expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100);
          expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(70);
        }
      }
      expect(seen).toBeGreaterThan(20);
    });
  }
});
