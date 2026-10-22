import { describe, it, expect } from 'vitest';
import { y2Duration } from '../../src/curriculum/year2/measure';

const seeded = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

describe('y2-duration end-time questions draw the start clock (#2271)', () => {
  it('every stage-3 question carries a clock for the start time', () => {
    const r = seeded(2271);
    for (let i = 0; i < 200; i++) {
      const q = y2Duration(3, r);
      expect(q.visual).toMatchObject({ type: 'clock' });
      if (q.visual?.type !== 'clock') throw new Error('no clock');
      expect(q.visual.h).toBeGreaterThanOrEqual(1);
      expect(q.visual.h).toBeLessThanOrEqual(12);
      expect([0, 15, 30, 45]).toContain(q.visual.m);
    }
  });
});
