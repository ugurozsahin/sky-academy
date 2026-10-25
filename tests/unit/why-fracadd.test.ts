// #2317 (same-denominator fraction add and subtract: y3-fracadd, y4-fracadd): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const vals = (s: string) => [...s.matchAll(/(\d+)\/(\d+)/g)].map(m => [Number(m[1]), Number(m[2])]);

describe('same-denominator fraction whys (#2317)', () => {
  for (const id of ['y3-fracadd', 'y4-fracadd']) for (const d of [1, 2, 3] as Difficulty[]) {
    it(`${id} d${d}: the why's sums are true and name the answer`, () => {
      for (const q of draws(id, d)) {
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        // every "a + b = c" and "a − b = c" run of plain numbers in the why is arithmetic that holds
        for (const m of w.matchAll(/(\d+) ([+−]) (\d+)(?: ([+−]) (\d+))? = (\d+)(?![\d/])/g)) {
          const [a, o1, b, o2, c, r] = [Number(m[1]), m[2], Number(m[3]), m[4], m[5] === undefined ? 0 : Number(m[5]), Number(m[6])];
          expect((o1 === '+' ? a + b : a - b) + (o2 === '−' ? -c : c), w).toBe(r);
        }
        // fraction runs keep one bottom throughout, and the answer is one of them (a whole is d/d)
        const fr = vals(w);
        if (fr.length) {
          expect(new Set(fr.map(x => x[1])).size, w).toBe(1);
          expect(fr.some(x => (q.answer === '1' ? x[0] === x[1] : q.answer === `${x[0]}/${x[1]}`)), w).toBe(true);
        }
      }
    });
  }
});
