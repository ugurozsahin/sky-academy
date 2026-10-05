import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';
import { labelEm } from './helpers/r-lbl';
import { AXIS_FRAME, AXIS_FS, barSlot } from '../../src/ui/vis-axis-chart';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-charts')!;
const DRAWS = 2000;
const draws = (d: Difficulty) => { const r = rng(1076 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
type Chart = Extract<NonNullable<Question['visual']>, { type: 'chart' }>;

/** Independent oracle: the answer read from the prompt and the rows alone. */
function oracle(c: Question): number {
  const v = c.visual as Chart, n = (w: string) => v.rows.find(r => r.label === w)!.n;
  let m: RegExpMatchArray | null;
  if ((m = c.prompt.match(/^How many chose (\w+)\?$/))) return n(m[1]);
  if ((m = c.prompt.match(/^How many (more|fewer) chose (\w+) than (\w+)\?$/))) return m[1] === 'more' ? n(m[2]) - n(m[3]) : n(m[3]) - n(m[2]);
  if ((m = c.prompt.match(/^How many more chose (\w+) and (\w+) together than (\w+)\?$/))) return n(m[1]) + n(m[2]) - n(m[3]);
  expect(c.prompt).toBe('How many children were asked altogether?');
  return v.rows.reduce((s, r) => s + r.n, 0);
}

describe('y3-charts (#1076)', () => {
  it('is registered once, in Year 3, as a statistics topic', () => {
    expect(TOPICS.filter(t => t.id === 'y3-charts')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.strand).toBe('stats');
    expect(topic.title).toBe('Bar Charts and Pictograms');
  });

  it('every answer equals the oracle, is positive, and sits once among four distinct non-negative options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(Number(c.answer), c.prompt).toBe(oracle(c));
      expect(Number(c.answer), c.prompt).toBeGreaterThan(0);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      for (const o of c.options) expect(Number.isInteger(Number(o)) && Number(o) >= 0, `${c.prompt} ${o}`).toBe(true);
    }
  });

  it('the visual is a chart of 3–5 plain labelled rows whose bars fit the axis', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const v = c.visual as Chart;
      expect(v.type).toBe('chart');
      expect(v.rows.length).toBeGreaterThanOrEqual(3);
      expect(v.rows.length).toBeLessThanOrEqual(d === 1 ? 4 : 5);
      expect(new Set(v.rows.map(r => r.label)).size).toBe(v.rows.length);
      for (const r of v.rows) {
        expect(r.label, 'plain word').toMatch(/^[a-z]{2,7}$/);
        expect(labelEm(r.label) * AXIS_FS, r.label).toBeLessThanOrEqual(barSlot(AXIS_FRAME, 5));
      }
      if (v.kind === 'bar') {
        expect([2, 5, 10]).toContain(v.step);
        expect(v.max % v.step).toBe(0);
        expect(v.max / v.step).toBeLessThanOrEqual(10);
        for (const r of v.rows) expect(r.n).toBeLessThanOrEqual(v.max);
        expect(Math.max(...v.rows.map(r => r.n)), 'the axis ends at the first gridline at or above the tallest bar').toBeGreaterThan(v.max - v.step);
      } else if (v.kind === 'pictogram') for (const r of v.rows) expect(r.n % v.each).toBe(0);
      else throw new Error(`unexpected kind ${v.kind}`);
    }
  });

  it('d1 is one bar read off a gridline, step 2 or 5; d2 adds pictograms, step 10 and more/fewer; d3 is two-step with halfway bars', () => {
    const kinds = (d: Difficulty) => new Set(draws(d).map(c => (c.visual as Chart).kind));
    for (const c of draws(1)) {
      const v = c.visual as Extract<Chart, { kind: 'bar' }>;
      expect(v.kind).toBe('bar');
      expect([2, 5]).toContain(v.step);
      expect(c.prompt).toMatch(/^How many chose /);
      for (const r of v.rows) expect(r.n % v.step).toBe(0);
    }
    expect(kinds(2)).toEqual(new Set(['bar', 'pictogram']));
    const d2 = draws(2).map(c => c.prompt);
    expect(d2.some(p => p.includes('more chose'))).toBe(true);
    expect(d2.some(p => p.includes('fewer chose'))).toBe(true);
    expect(draws(2).some(c => (c.visual as Extract<Chart, { kind: 'bar' }>).step === 10)).toBe(true);
    const d3 = draws(3);
    expect(d3.some(c => c.prompt.includes('together'))).toBe(true);
    expect(d3.some(c => c.prompt.includes('altogether'))).toBe(true);
    expect(d3.some(c => { const v = c.visual as Chart; return v.kind === 'bar' && v.rows.some(r => r.n % v.step !== 0); })).toBe(true);
  });

  it('offers the gridline-count slip (the scale read as 1s) on cards where it is a different number', () => {
    let seen = 0;
    for (const c of draws(2)) {
      const v = c.visual as Chart;
      if (v.kind !== 'bar' || !/^How many chose /.test(c.prompt)) continue;
      seen++;
      expect(c.options, c.prompt).toContain(String(Number(c.answer) / v.step));
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('every card has a spoken form that names the chart and has no digit-slash or question mark', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d).slice(0, 300)) {
      expect(c.say, c.prompt).toMatch(/^Look at the (bar chart|pictogram)\./);
      expect(c.say, c.prompt).not.toMatch(/\d\/\d|\?/);
    }
  });

  it('decoys leak neither the units nor the leading digit more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units, `d${d}`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
