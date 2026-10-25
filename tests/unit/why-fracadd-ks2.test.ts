// #2317 (unlike-denominator fraction add and subtract: y5-fracadd, y6-fracadd): every "a/D ± b/D = c/D" run in a why is arithmetic that holds.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('unlike-denominator fraction whys (#2317)', () => {
  for (const id of ['y5-fracadd', 'y6-fracadd']) for (const d of [1, 2, 3] as Difficulty[]) {
    it(`${id} d${d}: the working adds up and ends on the answer`, () => {
      for (const q of draws(id, d)) {
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        for (const m of w.matchAll(/(\d+)\/(\d+) ([+−]) (\d+)\/(\d+) = (\d+)\/(\d+)/g)) {
          const a = Number(m[1]);
          expect(m[2], w).toBe(m[5]); expect(m[2], w).toBe(m[7]);
          expect(m[3] === '+' ? a + Number(m[4]) : a - Number(m[4]), w).toBe(Number(m[6]));
        }
      }
    });
  }
});
