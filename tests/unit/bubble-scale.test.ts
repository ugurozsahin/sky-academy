// #2288: Reception and Year 1 bubbles are bigger; Year 2 up is unchanged; no wave overlaps at 390×844.
import { describe, expect, it } from 'vitest';
import { BUBBLE_SCALE, layoutWave, waveRadius, type WaveOpts } from '../../src/game/bubbles';
import { YEARS } from '../../src/curriculum/types';

const W = 390, H = 844;
const rng = () => 0.5;
const opts = (n: number, scale?: number): WaveOpts => ({ labels: Array.from({ length: n }, (_, i) => String(i + 1)), speed: 1, scale });

describe('year bubble scale (#2288)', () => {
  it('draws Reception at least 50 px and Year 1 at least 36 px on a 390 px phone', () => {
    expect(waveRadius(W, H, false, 3, BUBBLE_SCALE.reception)).toBeGreaterThanOrEqual(50);
    expect(waveRadius(W, H, false, 3, BUBBLE_SCALE.year1)).toBeGreaterThanOrEqual(36);
  });
  it('leaves Year 2 up at the old radius', () => {
    for (const y of YEARS.filter(y => y.id !== 'reception' && y.id !== 'year1')) expect(BUBBLE_SCALE[y.id]).toBeUndefined();
    expect(waveRadius(W, H, false, 3)).toBeCloseTo(33.15, 1);
  });
  it('never grows past a third of the width, so three bubbles always fit across', () => {
    expect(waveRadius(W, H, true, 3, 5)).toBeLessThanOrEqual(((W - 16) / 3 - 10) / 2);
  });
  it('lays out 2, 3 and 4 Reception answers with no two bubbles in one launch batch overlapping', () => {
    for (const n of [2, 3, 4]) {
      const plan = layoutWave(opts(n, BUBBLE_SCALE.reception), { W, H, topInset: 120 }, 1, 0, rng);
      expect(plan.r).toBeGreaterThanOrEqual(50);
      for (let b = 0; b < n; b += plan.perBatch) {
        const row = plan.bubbles.slice(b, b + plan.perBatch).map(x => x.x).sort((a, c) => a - c);
        for (let i = 1; i < row.length; i++) expect(row[i] - row[i - 1]).toBeGreaterThanOrEqual(2 * plan.r);
        expect(row[0]).toBeGreaterThanOrEqual(plan.r); expect(row[row.length - 1]).toBeLessThanOrEqual(W - plan.r);
      }
    }
  });
});
