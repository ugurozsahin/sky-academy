import { describe, it, expect } from 'vitest';
import { y2Duration } from '../../src/curriculum/year2/measure';
import { clockPhrase } from '../../src/curriculum/year2';

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
      // The clock shows the start named in the question, never the end (the correct option).
      const start = clockPhrase(q.visual.h, q.visual.m);
      expect(q.prompt).toContain(`starts at ${start} `);
      expect(q.answer).not.toBe(start);
    }
  });
  it('stages 1 and 2 stay clock-free', () => {
    const r = seeded(2272);
    for (const d of [1, 2] as const) for (let i = 0; i < 100; i++) expect(y2Duration(d, r).visual).toBeUndefined();
  });
});
