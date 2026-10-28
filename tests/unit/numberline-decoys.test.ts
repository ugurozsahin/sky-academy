import { describe, expect, it } from 'vitest';
import { y2Line } from '../../src/curriculum/year2';
import type { Question } from '../../src/curriculum/types';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('number-line decoys are never already printed on the line (#2319)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`y2-line difficulty ${d}`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const q: Question = y2Line(d, rngOf(seed));
        const v = q.visual as { type: 'numberline'; from: number; to: number; step: number; mark: number };
        const printed = new Set<number>();
        for (let x = v.from; x <= v.to; x += v.step) if (x !== v.mark) printed.add(x);
        const decoys = q.options.filter(o => o !== q.answer).map(Number);
        expect(decoys.length).toBe(3);
        expect(new Set(q.options).size).toBe(4);
        for (const x of decoys) expect(printed.has(x), `seed ${seed}: ${x} is printed on the line`).toBe(false);
      }
    });
  }
});
