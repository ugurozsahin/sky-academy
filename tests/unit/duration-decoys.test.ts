import { describe, expect, it } from 'vitest';
import { y2Duration, DUR_FACTS } from '../../src/curriculum/year2/measure';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-duration fact cards offer the other facts as decoys (#2319)', () => {
  it('d1: every option is one of the four fact counts, and the four are distinct, over 400 seeds', () => {
    const counts = DUR_FACTS.map(f => String(f.n)).sort();
    for (let seed = 1; seed <= 400; seed++) {
      const q = y2Duration(1, rngOf(seed));
      expect([...q.options].sort(), q.prompt).toEqual(counts);
      expect(q.options).toContain(q.answer);
    }
  });
});
