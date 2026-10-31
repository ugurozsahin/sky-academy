import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { SHAPES_2D, sameShape } from '../../src/curriculum/util';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gen = TOPICS.find(x => x.id === 'r-shapes')!.gen;
const set = SHAPES_2D.slice(0, 4);
const N = 250;

describe('#2320 r-shapes: the wrong shapes are the nearest look-alikes', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over ${N} seeds the answer is unique and the closest legal shapes by side count are offered`, () => {
      const r = rng(2500 + d);
      for (let i = 0; i < N; i++) {
        const q = gen(d, r);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        // Work back to the asked shape: glyph answer (d1-d2) or name answer (d3).
        const asked = set.find(s => s[0] === q.answer || s[1] === q.answer)!;
        const shown = q.options.map(o => set.find(s => s[0] === o || s[1] === o)!);
        for (const s of shown) if (s !== asked) expect(sameShape(s[1], asked[1])).toBe(false);
        const legal = set.filter(s => !sameShape(s[1], asked[1]));
        const want = d === 1 ? 2 : legal.length;
        expect(shown.length - 1).toBe(want);
        // No unshown legal shape is nearer in side count than a shown one.
        const dist = (s: typeof asked) => Math.abs(s[2] - asked[2]);
        const worstShown = Math.max(...shown.filter(s => s !== asked).map(dist));
        for (const s of legal) if (!shown.includes(s)) expect(dist(s)).toBeGreaterThanOrEqual(worstShown);
      }
    });
  }
});
