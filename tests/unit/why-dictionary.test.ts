// #2318: y3-dictionary says which letters decide the order, in the order they fall; commas so the voice never says "minus".
import { describe, expect, it } from 'vitest';
import { y3Dictionary } from '../../src/curriculum/year3-dictionary';
import type { Difficulty } from '../../src/curriculum';
import { symSay } from '../../src/curriculum/util';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y3-dictionary says why (#2318)', () => {
  it('names the deciding letter of every word, in dictionary order', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = y3Dictionary(d, rngOf(s * 31 + d));
      const m = q.why!.match(/^(Second|Third|Fourth) letters in order: (.+)$/);
      expect(m, q.why).not.toBeNull();
      const n = { Second: 2, Third: 3, Fourth: 4 }[m![1] as 'Second']!;
      expect(m![2].split(', '), q.why).toEqual(q.sequence!.map(w => w[n - 1]));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(symSay(q.why!)).not.toMatch(/minus/);
    }
  });
});
