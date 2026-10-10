import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, GeoPart, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-area')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1244 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Seg = Extract<GeoPart, { kind: 'segment' }>;
const parts = (q: Question): GeoPart[] => { const v = q.visual; if (v?.type !== 'geometry') throw new Error('no drawing'); return v.parts; };
const segs = (q: Question) => parts(q).filter((p): p is Seg => p.kind === 'segment');
const len = (s: Seg) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
const labelled = (q: Question) => segs(q).filter(s => s.label);
const cmOf = (s: Seg) => Number(/^(\d+) cm$/.exec(s.label!)![1]);

describe('y6-area (#1244)', () => {
  it('is registered for Year 6 maths in the measure strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'measure' }); });

  it('every card has four distinct options including the answer and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1/d2 oracle: the formula over the drawing\'s own labels, for 300 draws each', () => {
    let tri = 0, par = 0;
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const ls = labelled(q), [base, ...rest] = ls, h = ls.find(s => s !== base && Math.abs(s.a[0] - s.b[0]) < 1e-9)!;
      const b = cmOf(base), ht = cmOf(h), tri_ = /^Triangle/.test(q.prompt);
      tri_ ? tri++ : par++;
      expect(q.answer, q.prompt).toBe(String(tri_ ? b * ht / 2 : b * ht));
      expect(rest.length).toBeGreaterThanOrEqual(1);
    }
    expect(tri).toBeGreaterThan(150); expect(par).toBeGreaterThan(50);
  });

  it('drawing exactness: perpendicular height, one scale, foot on the base, every part inside the viewBox', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const ls = labelled(q), base = ls[0], h = ls.find(s => s !== base && Math.abs(s.a[0] - s.b[0]) < 1e-9)!;
      const dot = (base.b[0] - base.a[0]) * (h.b[0] - h.a[0]) + (base.b[1] - base.a[1]) * (h.b[1] - h.a[1]);
      expect(Math.abs(dot), q.prompt).toBeLessThan(1e-6);
      expect(Math.abs(len(base) / len(h) / (cmOf(base) / cmOf(h)) - 1), q.prompt).toBeLessThan(0.05);
      for (const s of ls) expect(Math.abs(len(s) / len(base) / (cmOf(s) / cmOf(base)) - 1), s.label).toBeLessThan(0.05);
      const foot = h.a[1] > h.b[1] ? h.a : h.b;
      expect(foot[1]).toBeCloseTo(base.a[1], 6);
      expect(foot[0]).toBeGreaterThanOrEqual(Math.min(base.a[0], base.b[0]) - 1e-9); expect(foot[0]).toBeLessThanOrEqual(Math.max(base.a[0], base.b[0]) + 1e-9);
      const mark = parts(q).filter(p => p.kind === 'angle');
      expect(mark).toHaveLength(1); expect(mark[0]).toMatchObject({ deg: 90, dir: 0 });
      for (const p of parts(q)) {
        const pts = p.kind === 'segment' ? [p.a, p.b, ...(p.labelAt ? [p.labelAt] : [])] : [p.at, [p.at[0] + (p.len ?? 16), p.at[1]], [p.at[0], p.at[1] - (p.len ?? 16)]];
        for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(70); }
      }
    }
  });

  it('every triangle card offers the not-halved decoy and every parallelogram card b × slanted side', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const ls = labelled(q), b = cmOf(ls[0]), h = cmOf(ls.find(s => s !== ls[0] && Math.abs(s.a[0] - s.b[0]) < 1e-9)!);
      if (/^Triangle/.test(q.prompt)) expect(q.options, q.prompt).toContain(String(b * h));
      else { const l = cmOf(ls.find(s => s !== ls[0] && Math.abs(s.a[0] - s.b[0]) > 1e-9)!); expect(q.options, q.prompt).toContain(String(b * l)); }
    }
  });

  it('d3: every card recomputes, prompts are at most 60 characters, all three types appear', () => {
    const kinds = { height: 0, gap: 0, base: 0 };
    for (const q of draw(3, 600)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      let m: RegExpExecArray | null;
      if ((m = /^Triangle area (\d+) cm², base (\d+) cm\. Height = \? cm$/.exec(q.prompt))) { kinds.height++; expect(Number(q.answer)).toBe(2 * Number(m[1]) / Number(m[2])); expect(q.options).toContain(String(Number(m[1]) / Number(m[2]))); }
      else if ((m = /^Base (\d+) cm, height (\d+) cm: parallelogram − triangle = \? cm²$/.exec(q.prompt))) { kinds.gap++; expect(Number(q.answer)).toBe(Number(m[1]) * Number(m[2]) - Number(m[1]) * Number(m[2]) / 2); expect(q.options).toContain(String(Number(m[1]) * Number(m[2]))); }
      else if ((m = /^Parallelogram area (\d+) cm², height (\d+) cm\. Base = \? cm$/.exec(q.prompt))) { kinds.base++; expect(Number(q.answer)).toBe(Number(m[1]) / Number(m[2])); }
      else throw new Error(`unexpected prompt ${q.prompt}`);
      expect(q.visual).toBeUndefined();
    }
    Object.values(kinds).forEach(n => expect(n).toBeGreaterThan(100));
  });

  it('leak limit (#1058): at most 30% of in-scope cards leave a last or leading digit unshared', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); if (s.counted > 0) { expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); } }
  });
});
