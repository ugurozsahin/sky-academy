import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y4-shortmult')!.gen;
const num = (s: string) => parseNum(s)!.v;

describe('y4-shortmult decoys are written-method slips, not ±1 neighbours (#2319)', () => {
  for (const d of [1, 2] as Difficulty[]) {
    it(`d${d}: no pick-one wrong answer sits one away from another option, over 300 seeds`, () => {
      let cards = 0, adjacent = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const q = gen(d, rngOf(seed * 7 + d));
        if (q.sequence) continue;                                  // a build card has digit bubbles, not number options
        cards++;
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        const vals = q.options.map(num);
        for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) if (Math.abs(vals[i] - vals[j]) === 1) adjacent++;
      }
      expect(cards).toBeGreaterThan(100);
      expect(adjacent).toBe(0);
    });
  }
});
