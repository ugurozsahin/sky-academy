import { describe, it, expect } from 'vitest';
import { y2Estimate } from '../../src/curriculum/year2-estimate';
import { renderVisual } from '../../src/ui/visuals';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('y2-estimate (#1004)', () => {
  const GAP = [0, 3, 30, 20], COUNT = [0, 3, 3, 4];
  it.each([1, 2, 3] as const)('d%i: the answer is the mark, decoys keep their gap and none is an end value', (d) => {
    const r = rng(d);
    for (let i = 0; i < 400; i++) {
      const q = y2Estimate(d, r), v = q.visual as { type: 'numberline'; from: number; to: number; mark: number; ends?: boolean };
      expect(v.ends).toBe(true);
      expect(Number(q.answer)).toBe(v.mark);
      expect(q.options).toHaveLength(COUNT[d]);
      const ds = q.options.filter(o => o !== q.answer).map(Number);
      for (const x of ds) { expect(x).not.toBe(v.from); expect(x).not.toBe(v.to); expect(Math.abs(x - v.mark)).toBeGreaterThanOrEqual(GAP[d]); }
      for (const a of ds) for (const b of ds) if (a !== b) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(GAP[d]);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe('numberline `ends` (#1004)', () => {
  const text = (h: string) => [...h.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(m => m[1]);
  it('prints only the two ends and the ? on an ends-only line', () => {
    const t = text(renderVisual({ type: 'numberline', from: 0, to: 100, step: 10, mark: 40, ends: true }));
    expect(t).toHaveLength(11);
    expect(t.filter(x => x !== '')).toEqual(['0', '?', '100']);
  });
  it('a line without `ends` is unchanged', () => {
    const v = { type: 'numberline' as const, from: 0, to: 5, mark: 3 };
    expect(renderVisual(v)).toBe(renderVisual({ ...v, ends: undefined }));
    expect(text(renderVisual(v))).toEqual(['0', '1', '2', '?', '4', '5']);
  });
});
