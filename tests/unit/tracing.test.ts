import { describe, expect, it } from 'vitest';
import { GLYPH_MIN, MASK_SCALE, type TraceGrid, type TraceTally, markPoint, paintStroke, scoreTrace } from '../../src/game/tracing';

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

// #43: the pixel accounting behind `Tracer.result()` — which strokes cover which letter — used to live inside
// the class and needed a real canvas, so it was reachable only through the e2e suite. `markPoint`/`paintStroke`
// are the same maths as pure exports, so a synthetic glyph and a few synthetic strokes test it directly.
describe('markPoint / paintStroke — the pixel accounting behind Tracer.result() (#43)', () => {
  // A synthetic two-letter word on a 24x20 half-res grid: two vertical bars, 4 cells wide, 16 tall.
  // Canvas coordinates are twice grid coordinates (MASK_SCALE = 0.5), so cell (px, py) sits at (2px, 2py).
  const MW = 24, MH = 20, ROWS = [2, 17] as const, BARS = [[4, 7], [14, 17]] as const;
  const GLYPH_CELLS = 4 * 16;
  const newGrid = (): TraceGrid => {
    const mask = new Uint8Array(MW * MH);
    BARS.forEach(([x0, x1], gi) => { for (let y = ROWS[0]; y <= ROWS[1]; y++) for (let x = x0; x <= x1; x++) mask[y * MW + x] = gi + 1; });
    return { mask, covered: new Uint8Array(MW * MH), mw: MW, mh: MH };
  };
  const newTally = (): TraceTally => ({ glyphHits: [0, 0], insidePts: 0, outsidePts: 0 });
  const at = (px: number, py: number) => [px / MASK_SCALE, py / MASK_SCALE] as const;   // grid cell -> canvas point
  // Tracer.result() is exactly this over its own tally.
  const result = (t: TraceTally) => scoreTrace(t.glyphHits, [GLYPH_CELLS, GLYPH_CELLS], t.insidePts, t.outsidePts);
  /** Paint every cell of the given letters, the way a child eventually covers a glyph. */
  const traceLetters = (g: TraceGrid, t: TraceTally, letters: number[], brush = 1) => {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const gi = g.mask[y * MW + x]; if (gi && letters.includes(gi - 1)) markPoint(g, t, ...at(x, y), brush);
    }
  };

  it('counts a point on the glyph as inside and one on blank paper as outside', () => {
    const g = newGrid(), t = newTally();
    markPoint(g, t, ...at(5, 8), 1);                       // inside the first bar
    expect([t.insidePts, t.outsidePts]).toEqual([1, 0]);
    expect(t.glyphHits[0]).toBeGreaterThan(0); expect(t.glyphHits[1]).toBe(0);
    markPoint(g, t, ...at(11, 8), 1);                      // the gap between the two letters
    expect([t.insidePts, t.outsidePts]).toEqual([1, 1]);
  });

  it('claims each cell once, so going over a letter again cannot inflate its coverage', () => {
    const g = newGrid(), t = newTally();
    paintStroke(g, t, { x: 10, y: 6 }, { x: 10, y: 32 }, 3);
    const first = [...t.glyphHits];
    expect(first[0]).toBeGreaterThan(0);
    paintStroke(g, t, { x: 10, y: 6 }, { x: 10, y: 32 }, 3);   // the child goes over it a second time
    expect(t.glyphHits).toEqual(first);                        // …and covers nothing new
    expect(t.insidePts).toBe(16);                              // but the strokes themselves are still counted
  });

  it('claims the brush disc, not the square it scans — a stroke that only grazes a letter does not cover it', () => {
    const g = newGrid(), t = newTally();
    markPoint(g, t, ...at(11, 8), 4);   // r = 2, so the 9x9 scan reaches both bars but the disc reaches neither
    expect(t.insidePts).toBe(1);        // it did land on the glyph…
    expect(t.glyphHits).toEqual([0, 0]);                                     // …without covering a single cell
    expect([...g.covered].some(Boolean)).toBe(false);
  });

  it('fails the trace when only one letter of the word is covered, and passes when both are (#43)', () => {
    const g = newGrid(), t = newTally();
    traceLetters(g, t, [0]);
    expect(t.glyphHits[0]).toBe(GLYPH_CELLS);
    let r = result(t);
    expect(r.glyphs).toEqual([1, 0]); expect(r.weakest).toBe(1); expect(r.pass).toBe(false);
    traceLetters(g, t, [1]);
    r = result(t);
    expect(r.glyphs).toEqual([1, 1]); expect(r.coverage).toBe(1); expect(r.outside).toBe(0); expect(r.pass).toBe(true);
  });

  it('fails a fully covered word that was mostly scribbled off the lines', () => {
    const g = newGrid(), t = newTally();
    traceLetters(g, t, [0, 1]);
    expect(result(t).pass).toBe(true);
    const onGlyph = t.insidePts;                                              // snapshot: markPoint moves this counter
    for (let i = 0; i < onGlyph; i++) markPoint(g, t, ...at(11, 8), 1);        // scribble in the gap, as many points again
    const r = result(t);
    expect(r.coverage).toBe(1);              // every letter still covered…
    expect(r.outside).toBeCloseTo(0.5, 6);   // …but half the child's strokes never touched the glyph
    expect(r.pass).toBe(false);
  });

  it('samples a stroke about every 4px, marking both ends, and marks a tap twice', () => {
    const g = newGrid(), t = newTally();
    paintStroke(g, t, { x: 0, y: 0 }, { x: 40, y: 0 }, 1);          // length 40 -> ceil(40/4) + 1 points
    expect(t.insidePts + t.outsidePts).toBe(11);
    const t2 = newTally();
    paintStroke(g, t2, { x: 0, y: 30 }, { x: 9, y: 30 }, 1);        // length 9 -> ceil(9/4) + 1 = 4
    expect(t2.insidePts + t2.outsidePts).toBe(4);
    const t3 = newTally();
    paintStroke(g, t3, { x: 7, y: 7 }, { x: 7, y: 7 }, 1);          // a tap: both ends are the same point
    expect(t3.insidePts + t3.outsidePts).toBe(2);
  });

  it('ignores everything off the edge of the paper — a stroke off-screen never throws or writes out of bounds', () => {
    const g = newGrid(), t = newTally();
    expect(() => paintStroke(g, t, { x: -900, y: -900 }, { x: 900, y: 900 }, 30)).not.toThrow();
    markPoint(g, t, -1e6, -1e6, 20); markPoint(g, t, 1e6, 1e6, 20);
    expect(g.covered.length).toBe(MW * MH);
    expect(t.glyphHits[0] + t.glyphHits[1]).toBeLessThanOrEqual(GLYPH_CELLS * 2);
    const off = newTally();
    markPoint(newGrid(), off, ...at(-50, -50), 4);
    expect([off.insidePts, off.outsidePts]).toEqual([0, 1]);        // wholly off the grid: nothing masked, so outside
  });
});
