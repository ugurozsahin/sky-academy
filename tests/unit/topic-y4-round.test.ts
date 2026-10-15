import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { y4RoundCard } from '../../src/curriculum/year4-round';
import { renderVisual } from '../../src/ui/visuals';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-round')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1134 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const isLine = (q: { visual?: { type: string } }) => q.visual?.type === 'numberline';
const parse = (prompt: string) => { const m = prompt.match(/\d[\d,]*/g)!; return { n: num(m[0]), p: num(m[1]) }; };

describe('y4-round (#1134)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); expect(topic.subject).toBe('maths'); });

  it('the oracle: floor(n / p + 1/2) * p, so a halfway number rounds up', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400).filter(q => !isLine(q))) {
      const { n, p } = parse(q.prompt);
      expect(num(q.answer)).toBe(Math.floor(n / p + 0.5) * p);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(o).toMatch(/^\d{1,3}(,\d{3})*$/); expect(num(o)).toBeLessThanOrEqual(10000); });
    }
    const half = [1350, 4250, 9995].map(n => ({ n, p: n === 9995 ? 10 : 100 }));
    expect(half.map(h => Math.floor(h.n / h.p + 0.5) * h.p)).toEqual([1400, 4300, 10000]);
  });

  it('the ladder: d1 1,000–1,999 to 10; d2 to 100 or 1,000; d3 rolls over a place and draws line cards', () => {
    for (const q of draw(1, 300)) { const { n, p } = parse(q.prompt); expect(p).toBe(10); expect(n).toBeGreaterThanOrEqual(1000); expect(n).toBeLessThanOrEqual(1999); }
    const ps = new Set<number>();
    for (const q of draw(2, 300)) { expect(isLine(q)).toBe(false); const { n, p } = parse(q.prompt); ps.add(p); expect(n).toBeGreaterThanOrEqual(1000); expect(n).toBeLessThanOrEqual(9999); }
    expect([...ps].sort((a, b) => a - b)).toEqual([100, 1000]);
    const d3 = draw(3, 600);
    expect(d3.filter(isLine).length).toBeGreaterThan(100);
    expect(d3.filter(q => !isLine(q) && num(q.answer) === 10000).length).toBeGreaterThan(10);
  });

  it('the decoys are the slips: wrong way, and the wrong place', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d, 300).filter(q => !isLine(q))) {
      const { n, p } = parse(q.prompt), a = num(q.answer);
      const wrong = a > n ? a - p : a + p;
      if (wrong <= 10000) expect(q.options.map(num)).toContain(wrong);
      if (p > 10) { const fine = Math.floor(n / (p / 10) + 0.5) * (p / 10); if (fine !== a) expect(q.options.map(num)).toContain(fine); }
    }
  });

  it('line cards: the answer is the mark; decoys keep 3,000 apart; no end value; 11 labels; only the ends print', () => {
    const lines = draw(3, 600).filter(isLine);
    for (const q of lines) {
      const v = q.visual as { type: 'numberline'; from: number; to: number; mark: number; ends?: boolean; labels?: string[] };
      expect(v.ends).toBe(true); expect(v.labels).toHaveLength(11); expect(num(q.answer)).toBe(v.mark);
      expect(q.options).toHaveLength(3);
      const ds = q.options.filter(o => o !== q.answer).map(num);
      for (const x of ds) { expect(x % 1000).toBe(0); expect([0, 10000]).not.toContain(x); expect(Math.abs(x - v.mark)).toBeGreaterThanOrEqual(3000); }
      expect(Math.abs(ds[0] - ds[1])).toBeGreaterThanOrEqual(3000);
    }
    const t = [...renderVisual(lines[0].visual!).matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(m => m[1]).filter(Boolean);
    expect(t).toContain('0'); expect(t).toContain('10,000');
    expect(t.filter(x => /^\d/.test(x))).toHaveLength(2);
  });

  it('at most 30% of rounding cards have a unique leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(y4RoundCard, d, 2000);
      expect(s.leading / s.counted).toBeLessThanOrEqual(0.3);
    }
  });
});
