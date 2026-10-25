// #2317 (equivalent fractions family): the why states the true multiplier, and both fractions are equal by value.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const val = (f: string) => { const [n, d] = f.split('/').map(Number); return n / d; };

describe('equivalent fraction whys (#2317)', () => {
  for (const id of ['y3-fracequiv', 'y4-fracequiv', 'y5-fracequiv']) {
    it(`${id}: every "a/b = c/d" in a why is a true equality, and the multiplier is the real one`, () => {
      for (const q of ([1, 2, 3] as Difficulty[]).flatMap(d => draws(id, d))) {
        if (q.why!.startsWith('Top and bottom both')) {
          const m = /both ([×÷]) (\d+): (\d+\/\d+) = (\d+\/\d+)/.exec(q.why!)!;
          expect(m, q.why).toBeTruthy();
          expect(val(m[3]), q.why).toBeCloseTo(val(m[4]), 9);
          const [n1, d1] = m[3].split('/').map(Number), [n2, d2] = m[4].split('/').map(Number), k = Number(m[2]);
          expect(m[1] === '×' ? [n1 * k, d1 * k] : [n1 / k, d1 / k], q.why).toEqual([n2, d2]);
        } else if (q.why!.includes(' = ')) {
          const fs = q.why!.split(' = ');
          for (const f of fs) expect(val(f), q.why).toBeCloseTo(val(fs[0]), 9);
        } else expect(q.why).toMatch(/is a different size from/);
      }
    });
  }
});
