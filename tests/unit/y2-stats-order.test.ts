import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Question } from '../../src/curriculum/types';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

type Chart = Extract<Question['visual'], { type: 'chart' }>;
const KIND = { 1: 'tally', 2: 'pictogram', 3: 'block' } as const;

/** Oracle for #1006: re-derive the order from the chart's own rows, never from the generator's bookkeeping. */
describe('y2-stats-order: slice the chart categories from most to least (#1006)', () => {
  const t = TOPICS.find(x => x.id === 'y2-stats-order')!;
  it('is registered beside y2-stats and stays out of Duel (sequenceFrom 1)', () => {
    expect(t.sequenceFrom).toBe(1);
    const ids = TOPICS.map(x => x.id);
    expect(ids.indexOf('y2-stats-order')).toBe(ids.indexOf('y2-stats') + 1);
  });
  it.each([1, 2, 3] as const)('difficulty %s: sequence is the rows by count, no ties, right kind', (d) => {
    const r = rng(1006 + d);
    for (let i = 0; i < 300; i++) {
      const q = t.gen(d, r);
      const v = q.visual as Chart;
      expect(v.type).toBe('chart');
      expect(v.kind).toBe(KIND[d]);
      expect(new Set(v.rows.map(x => x.n)).size, 'counts must all differ').toBe(3);
      const want = [...v.rows].sort((a, b) => b.n - a.n).map(x => x.label.split(' ').slice(1).join(' '));
      expect(q.sequence).toEqual(want);
      expect(q.answer).toBe(want.join(','));
      expect([...q.options].sort()).toEqual([...want].sort());
      if (v.kind === 'pictogram') {
        expect([2, 5]).toContain(v.each);
        for (const row of v.rows) expect(row.n % v.each).toBe(0);
      }
      const text = `${q.prompt} ${q.say ?? ''}`;
      for (const row of v.rows) expect(text, 'never states a count').not.toMatch(new RegExp(`\\b${row.n}\\b`));
    }
  });
});
