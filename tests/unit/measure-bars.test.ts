import { describe, it, expect } from 'vitest';
import { measureCompare } from '../../src/curriculum/util';
import { barVisual } from '../../src/curriculum/bar-axis';
import { HEAVIER, LONGER } from '../../src/curriculum/types';
import type { Difficulty } from '../../src/curriculum/types';

const seeded = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('measure games draw what they compare (#2271)', () => {
  it('every measureCompare question carries a bar per option, drawn within a valid axis', () => {
    const r = seeded(2271);
    for (const d of [1, 2, 3] as Difficulty[]) for (const [lo, hi, c] of [[3, 12, LONGER], [20, 99, HEAVIER], [100, 999, HEAVIER]] as const) for (let i = 0; i < 200; i++) {
      const q = measureCompare(r, d, 'rope', 'cm', c, lo, hi);
      const v = q.visual;
      if (v?.type !== 'chart' || v.kind !== 'bar') throw new Error('no bar chart');
      expect(v.rows.map(x => x.label).sort()).toEqual([...q.options].sort());
      expect(v.max % v.step).toBe(0);
      expect(v.max / v.step).toBeLessThanOrEqual(10);
      expect(Math.max(...v.rows.map(x => x.n))).toBeLessThanOrEqual(v.max);
    }
  });
  it('picks a whole-number axis for awkward tops', () => {
    expect(barVisual(['a'], [7])).toMatchObject({ step: 1, max: 7 });
    expect(barVisual(['a'], [99])).toMatchObject({ step: 10, max: 100 });
    expect(barVisual(['a'], [999])).toMatchObject({ step: 100, max: 1000 });
  });
});
