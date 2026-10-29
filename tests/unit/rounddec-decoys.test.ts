import { describe, expect, it } from 'vitest';
import { y5RoundDec } from '../../src/curriculum/year5-rounddec';
import type { Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const val = (s: string) => Number(s.replace('£', ''));

describe('y5-rounddec decoys stay near a small answer (#2319)', () => {
  for (const d of [1, 2] as Difficulty[]) {
    it(`d${d}: an answer under 10 has no decoy more than 3 from the number given, over 400 seeds`, () => {
      let small = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const q = y5RoundDec(d, rngOf(seed)), a = val(q.answer);
        if (a >= 10) continue;
        small++;
        const given = val(/Round (£?[\d.]+) /.exec(q.prompt)![1]);
        expect(new Set(q.options).size, q.prompt).toBe(4);
        for (const o of q.options) expect(Math.abs(val(o) - given), `${q.prompt} → ${o}`).toBeLessThanOrEqual(3.5);
      }
      expect(small).toBeGreaterThan(5);
    });
  }
});
