import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-patterns')!;
const DRAWS = 150;
const UNIT = { 1: 'AB', 2: 'ABB', 3: 'ABBC' } as const;
const cellsOf = (q: { visual?: unknown }) => (q.visual as { type: string; text: string }).text.split(' ');

/** #970: Reception continues AB, ABB and ABBC repeating patterns; the gap is always the last cell. */
describe('r-patterns (#970)', () => {
  it('the answer is the unit object that the strip puts in the gap, and no decoy equals it', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9700 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const cells = cellsOf(q);
        expect(cells[cells.length - 1]).toBe('_');
        const unit = UNIT[d];
        const seen = cells.slice(0, -1);
        // Each letter maps to one object, and the gap continues the unit.
        const map = new Map<string, string>();
        [...unit].forEach((ch, k) => { const g = seen[k]; if (map.has(ch)) expect(map.get(ch)).toBe(g); map.set(ch, g); });
        expect(new Set(map.values()).size, 'each letter is a different object').toBe(new Set(unit).size);
        expect(q.answer).toBe(map.get(unit[seen.length % unit.length]));
        expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
      }
    }
  });

  it('two whole repeats precede the gap, and no strip is longer than 9 cells', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9710 + d);
      for (let i = 0; i < DRAWS; i++) {
        const cells = cellsOf(topic.gen(d, r));
        const unit = UNIT[d];
        expect(cells.length).toBeLessThanOrEqual(9);
        expect(cells.length - 1).toBeGreaterThanOrEqual(unit.length * 2);
        for (let k = unit.length; k < cells.length - 1; k++) expect(cells[k]).toBe(cells[k - unit.length]);
      }
    }
  });

  it('offers 3 options at d1 and 4 at d2/d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const q = topic.gen(d, rng(9720 + d));
      expect(q.options).toHaveLength(d === 1 ? 3 : 4);
    }
  });
});
