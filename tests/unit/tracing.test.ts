import { describe, expect, it } from 'vitest';
import { GLYPH_MIN, scoreTrace } from '../../src/game/tracing';

describe('scoreTrace (per-letter pass rule)', () => {
  const totals = [100, 100, 100];
  it('fails when only 2 of 3 letters are traced, even though overall coverage is 66%', () => {
    const r = scoreTrace([100, 100, 0], totals, 200, 0);
    expect(r.coverage).toBeCloseTo(0.667, 2); expect(r.pass).toBe(false); expect(r.weakest).toBe(2);
  });
  it('fails when one letter is barely touched', () => {
    expect(scoreTrace([95, 90, 30], totals, 200, 10).pass).toBe(false);
    expect(scoreTrace([95, 90, Math.ceil(GLYPH_MIN * 100)], totals, 200, 10).pass).toBe(true);
  });
  it('passes a careful trace and fails a scribble mostly outside the lines', () => {
    expect(scoreTrace([90, 85, 80], totals, 300, 60).pass).toBe(true);
    expect(scoreTrace([90, 85, 80], totals, 100, 120).pass).toBe(false);
  });
  it('a single letter still needs most of the glyph', () => {
    expect(scoreTrace([50], [100], 50, 0).pass).toBe(false);
    expect(scoreTrace([70], [100], 50, 0).pass).toBe(true);
  });
  it('spaces (no pixels) never block a pass', () => {
    expect(scoreTrace([80, 0, 80], [100, 0, 100], 100, 0).pass).toBe(true);
  });
});
