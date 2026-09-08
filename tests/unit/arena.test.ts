import { describe, expect, it } from 'vitest';
import { dealOrdered, fitLabel, labelFont, segCircle } from '../../src/game/arena';

describe('dealOrdered — sequence words are dealt in order across the batches (#62)', () => {
  const batchOf = (order: number[], perBatch: number, idx: number) => Math.floor(order.indexOf(idx) / perBatch);
  it('never puts a later word in an earlier batch, and keeps every word within one batch of its predecessor', () => {
    const words = ['The', 'cat', 'sat', 'on', 'the', 'mat.', 'Yes'], decoys = ['dog', 'red', 'big'];
    for (let trial = 0; trial < 200; trial++) {
      const labels = [...words, ...decoys].sort(() => Math.random() - 0.5);
      const order = dealOrdered(labels, words, 4);
      expect([...order].sort((a, b) => a - b)).toEqual(labels.map((_, i) => i));      // every bubble dealt exactly once
      const seen: number[] = []; const used = new Set<number>();
      for (const w of words) { const i = labels.findIndex((l, k) => l === w && !used.has(k)); used.add(i); seen.push(batchOf(order, 4, i)); }
      for (let k = 1; k < seen.length; k++) {
        expect(seen[k]).toBeGreaterThanOrEqual(seen[k - 1]);                          // in order
        expect(seen[k] - seen[k - 1]).toBeLessThanOrEqual(1);                          // never skips a batch
      }
      expect(seen[0]).toBe(0);                                                         // the first word is always in the first batch
    }
  });
  it('handles a single batch, repeated words and decoy-free waves', () => {
    expect(dealOrdered(['a', 'b', 'c'], ['a', 'b', 'c'], 4)).toHaveLength(3);
    const labels = ['the', 'the', 'end', 'x'];
    const order = dealOrdered(labels, ['the', 'the', 'end'], 2);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(Math.floor(order.indexOf(2) / 2)).toBeGreaterThanOrEqual(Math.floor(order.indexOf(0) / 2));   // duplicates keep their order too ('end' never before a 'the')
  });
});

describe('fitLabel — label font sized once at spawn, not per frame (#28)', () => {
  // A fake measurer: width grows with the font size (the `NNpx` out of the font string) and the label length.
  const sizeOf = (font: string) => parseFloat(font.match(/([\d.]+)px/)![1]);
  const measurer = (label: string, perChar: number) => (font: string) => sizeOf(font) * label.length * perChar;

  it('starts from the length-based size and keeps it when the label already fits', () => {
    // '12' (<=2 chars) starts at r*1.05; a measurer that always fits leaves it untouched.
    expect(fitLabel('12', 50, () => 0)).toBeCloseTo(52.5);
    // 'help' (<=4) starts at r*0.7; narrow glyphs never trip the r*1.75 limit, so no shrink.
    expect(fitLabel('help', 40, measurer('help', 0.3))).toBeCloseTo(28);   // 40*0.7 = 28, width 28*4*0.3 = 33.6 < 70
  });

  it('shrinks a wide label until it fits r * 1.75, and never past the size-10 floor', () => {
    // 'hello' (len 5) at r=40 starts at 20; width = fs*5*0.9 = fs*4.5 must drop to <= 70 → fs = 15.
    expect(fitLabel('hello', 40, measurer('hello', 0.9))).toBe(15);
    // A measurer that never fits stops at the fs > 10 guard rather than looping forever.
    expect(fitLabel('12345678', 50, () => 9999)).toBe(10);
  });

  it('labelFont carries the weight, size and the Fredoka fallback stack', () => {
    expect(labelFont(24)).toBe('800 24px "Fredoka", "Baloo 2", "Nunito", system-ui, sans-serif');
  });
});

describe('segCircle — swipe-through-bubble hit test (#43)', () => {
  // A bubble of radius 20 at the origin.
  it('a slice straight through the centre hits', () => {
    expect(segCircle(-50, 0, 50, 0, 0, 0, 20)).toBe(true);
  });
  it('a slice that stays well clear misses', () => {
    expect(segCircle(-50, 50, 50, 50, 0, 0, 20)).toBe(false);   // 50px above, radius 20
  });
  it('grazes when the nearest point is exactly on the rim, misses just past it', () => {
    expect(segCircle(-50, 20, 50, 20, 0, 0, 20)).toBe(true);    // tangent: distance 20 === r
    expect(segCircle(-50, 21, 50, 21, 0, 0, 20)).toBe(false);   // 21 > r
  });
  it('clamps to the segment ends — a stroke ending inside the bubble hits, its infinite line does not fool it', () => {
    // The segment ends at (0,10), inside the bubble; the nearest point is that endpoint, not the projection.
    expect(segCircle(-50, 10, 0, 10, 0, 0, 20)).toBe(true);
    // The same infinite line passes through the centre, but the segment stops 40px short and to the side.
    expect(segCircle(-50, 60, -40, 55, 0, 0, 20)).toBe(false);
  });
  it('a zero-length stroke (a tap that did not move) hits only when the point is inside', () => {
    expect(segCircle(5, 5, 5, 5, 0, 0, 20)).toBe(true);         // l2 === 0, point within r
    expect(segCircle(30, 0, 30, 0, 0, 0, 20)).toBe(false);      // point outside r
  });
});
