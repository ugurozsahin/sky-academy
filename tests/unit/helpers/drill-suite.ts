// Shared suite for the times-table drills (#1125; #1126 reuses it): one table only, the oracle, #1058's leak limit.
import { describe, it, expect } from 'vitest';
import { topicById, drillsFor } from '../../../src/curriculum';
import type { Difficulty } from '../../../src/curriculum';
import { solve } from './ks2-oracle';
import { leakShares } from './decoy-leak';

const rngOf = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const DIFFS: Difficulty[] = [1, 2, 3];

export function drillSuite(id: string, table: number, year: 'year3' | 'year4' = 'year3'): void {
  const topic = topicById(id)!;
  describe(`${id} drill`, () => {
    it('is a drill row in its year, so it reaches the Sprint chooser only', () => {
      expect(topic.drill).toBe(true);
      expect(topic.year).toBe(year);
      expect(drillsFor(year, 'maths').map(t => t.id)).toContain(id);
    });
    it('every card uses its table only and meets the oracle, at d1–d3', () => {
      for (const d of DIFFS) for (let seed = 1; seed <= 300; seed++) {
        const c = topic.gen(d, rngOf(seed * 13 + d));
        expect(solve(c.prompt), c.prompt).toBe(Number(c.answer));
        expect(c.options, c.prompt).toContain(c.answer);
        const ns = (c.prompt.match(/\d+/g) ?? []).map(Number);
        if (/^\? × \d+ = \d+$/.test(c.prompt)) {
          expect(ns[0], c.prompt).toBe(table);
          expect(ns[1] / Number(c.answer), c.prompt).toBe(table);          // product over the answer is the table
        } else if (/÷ \d+ = \?$/.test(c.prompt)) {
          expect(ns[1], c.prompt).toBe(table);
          expect(ns[0] / Number(c.answer), c.prompt).toBe(table);
        } else if (/÷ \? =|× \? =/.test(c.prompt)) {
          expect(ns.includes(table), c.prompt).toBe(true);
        } else {
          expect(ns.slice(0, 2).includes(table), c.prompt).toBe(true);
        }
        if (d === 1) expect(c.prompt, c.prompt).toMatch(/^\d+ × \d+ = \?$/);
      }
    });
    for (const d of DIFFS) it(`#1058 leak limit at d${d}: at most 0.30 for the units and the leading digit`, () => {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3);
    });
  });
}
