import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, GeoPart, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { repeatKey } from '../../src/game/repeat-key';
import { leakShares } from './helpers/decoy-leak';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-circles')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1248 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
type Seg = Extract<GeoPart, { kind: 'segment' }>; type Circ = Extract<GeoPart, { kind: 'circle' }>;
const parts = (q: Question): GeoPart[] => { const v = q.visual; if (v?.type !== 'geometry') throw new Error('no drawing'); return v.parts; };
const segs = (q: Question) => parts(q).filter((p): p is Seg => p.kind === 'segment');
const circles = (q: Question) => parts(q).filter((p): p is Circ => p.kind === 'circle');
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const num = (s: string) => Number(/([\d.]+) cm/.exec(s)![1]);

describe('y6-circles (#1248)', () => {
  it('is registered for Year 6 maths in the geometry strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'geometry', title: 'Parts of a Circle' }); });

  it('every card has a drawing, a speakable say, a prompt of at most 60 characters and passes R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.visual?.type).toBe('geometry'); expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      expect(rLblProblem(q), q.prompt).toBeNull();
      for (const o of q.options) expect(o).not.toMatch(/radius|diameter|circumference/i);
    }
  });

  it('d1: the lettered radius runs centre to circle, the diameter runs through the centre, to 0.5 units, and the asked letter is its part', () => {
    const asked = new Set<string>();
    for (const q of draw(1)) {
      const [c] = circles(q), [dia, rad] = segs(q), part = /shows the (\w+)\?/.exec(q.prompt)![1]; asked.add(part);
      expect(q.options).toHaveLength(3); expect([...q.options].sort()).toEqual(['A', 'B', 'C']);
      expect(dist(rad.a, c.at), q.prompt).toBeLessThan(0.5); expect(Math.abs(dist(rad.b, c.at) - c.r)).toBeLessThan(0.5);
      expect(Math.abs(dist(dia.a, c.at) - c.r)).toBeLessThan(0.5); expect(Math.abs(dist(dia.b, c.at) - c.r)).toBeLessThan(0.5);
      expect(dist([(dia.a[0] + dia.b[0]) / 2, (dia.a[1] + dia.b[1]) / 2], c.at)).toBeLessThan(0.5);
      expect(Math.abs(dist(dia.a, dia.b) - 2 * dist(rad.a, rad.b))).toBeLessThan(1);
      const letter = part === 'radius' ? rad.label : part === 'diameter' ? dia.label : c.label;
      expect(q.answer, q.prompt).toBe(letter);
      expect(new Set([rad.label, dia.label, c.label]).size).toBe(3);
    }
    expect([...asked].sort()).toEqual(['circumference', 'diameter', 'radius']);
  });

  it('d2: d = 2r on every card, and the drawing carries the stated length on a segment that matches its kind', () => {
    let toDia = 0, toRad = 0;
    for (const q of draw(2)) {
      const m = /^(Radius|Diameter) (\d+) cm\. (Diameter|Radius) = \? cm$/.exec(q.prompt)!, given = Number(m[2]), [c] = circles(q), [s] = segs(q);
      expect(num(s.label!)).toBe(given);
      if (m[1] === 'Radius') { toDia++; expect(q.answer).toBe(String(2 * given)); expect(Math.abs(dist(s.a, c.at))).toBeLessThan(0.5); expect(Math.abs(dist(s.b, c.at) - c.r)).toBeLessThan(0.5); }
      else { toRad++; expect(q.answer).toBe(String(given / 2)); expect(Math.abs(dist(s.a, s.b) - 2 * c.r)).toBeLessThan(1); }
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
    }
    expect(toDia).toBeGreaterThan(100); expect(toRad).toBeGreaterThan(100);
  });

  it('d3: each reasoning card has the one value its words give', () => {
    const kinds = new Set<string>();
    for (const q of draw(3)) {
      let m: RegExpExecArray | null;
      if ((m = /^Two circles, radius (\d+) cm, side by side\. Width = \? cm$/.exec(q.prompt))) { kinds.add('two'); expect(q.answer).toBe(String(4 * Number(m[1]))); expect(circles(q)).toHaveLength(2); }
      else if ((m = /^Radius (\d+)\.5 cm\. Diameter = \? cm$/.exec(q.prompt))) { kinds.add('half'); expect(q.answer).toBe(String(2 * Number(m[1]) + 1)); }
      else if ((m = /^A circle just fits in a (\d+) cm square\. Radius = \? cm$/.exec(q.prompt))) { kinds.add('square'); expect(q.answer).toBe(String(Number(m[1]) / 2)); expect(parts(q).some(p => p.kind === 'polygon')).toBe(true); }
      else throw new Error(`unrecognised d3 prompt: ${q.prompt}`);
      expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
    }
    expect([...kinds].sort()).toEqual(['half', 'square', 'two']);
  });

  it('every drawn part sits inside the 100 × 70 box', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 100)) for (const p of parts(q)) {
      const pts = p.kind === 'segment' ? [p.a, p.b, ...(p.labelAt ? [p.labelAt] : [])] : p.kind === 'polygon' ? p.pts : p.kind === 'circle' ? [[p.at[0] - p.r, p.at[1] - p.r], [p.at[0] + p.r, p.at[1] + p.r]] : [];
      for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(70); }
    }
  });

  it('repeat key: cards that differ only in their circle fields get different keys', () => {
    const base = draw(2, 1)[0], other = { ...base, visual: { type: 'geometry' as const, parts: parts(base).map(p => p.kind === 'circle' ? { ...p, r: p.r - 3 } : p) } };
    expect(repeatKey(other)).not.toBe(repeatKey(base));
    const moved = { ...base, visual: { type: 'geometry' as const, parts: parts(base).map(p => p.kind === 'circle' ? { ...p, at: [p.at[0] + 2, p.at[1]] as [number, number] } : p) } };
    expect(repeatKey(moved)).not.toBe(repeatKey(base));
  });

  it('leak limit (#1058): at most 30 % of in-scope cards have a last or leading digit no decoy shares, at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      if (s.counted === 0) continue;
      expect(s.units / s.counted, `units d${d}`).toBeLessThanOrEqual(0.3); expect(s.leading / s.counted, `leading d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
