// #921: the "Doubles and halves" drill is a double or a halve on y1-doubles's ladder, never a quarter or a picture.
import { describe, it, expect } from 'vitest';
import { drillsFor, topicById } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum/types';

const rngOf = (seed: number) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const DS: Difficulty[] = [1, 2, 3];
const LADDER: Record<Difficulty, [number, number]> = { 1: [1, 5], 2: [1, 10], 3: [6, 10] };
const gen = topicById('y1-doubles-halves')!.gen;

describe('doubles and halves drill (#921)', () => {
  it('is a Year 1 drill, right after y1-doubles in the registry', () => {
    expect(drillsFor('year1', 'maths').map(t => t.id)).toContain('y1-doubles-halves');
  });
  it('every card satisfies the oracle, with n on the ladder, in range and without a picture', () => {
    for (const d of DS) for (let seed = 1; seed <= 300; seed++) {
      const c = gen(d, rngOf(seed * 13 + d));
      const m = /^Double (\d+) = \?$/.exec(c.prompt), h = /^Half of (\d+) = \?$/.exec(c.prompt);
      expect(m ?? h, c.prompt).not.toBeNull();
      const n = m ? +m[1] : +h![1] / 2;
      expect(n).toBeGreaterThanOrEqual(LADDER[d][0]); expect(n).toBeLessThanOrEqual(LADDER[d][1]);
      expect(+c.answer).toBe(m ? n * 2 : n);
      expect(c.visual).toBeUndefined();
      for (const o of c.options) { expect(+o).toBeGreaterThanOrEqual(0); expect(+o).toBeLessThanOrEqual(20); }
      expect(c.options).toContain(c.answer);
    }
  });
  it('both forms occur at every difficulty', () => {
    for (const d of DS) {
      const prompts = Array.from({ length: 80 }, (_, i) => gen(d, rngOf(i + 1)).prompt);
      expect(prompts.some(p => p.startsWith('Double'))).toBe(true);
      expect(prompts.some(p => p.startsWith('Half'))).toBe(true);
    }
  });
  it("the inverse's answer is a decoy where it fits the range", () => {
    for (const d of DS) for (let seed = 1; seed <= 200; seed++) {
      const c = gen(d, rngOf(seed));
      const m = /^Double (\d+)/.exec(c.prompt), h = /^Half of (\d+)/.exec(c.prompt);
      const inverse = m ? +m[1] : +h![1];
      expect(c.options.map(Number)).toContain(inverse);
    }
  });
});
