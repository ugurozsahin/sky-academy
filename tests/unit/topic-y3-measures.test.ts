import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-measures')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1097_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const val = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const unitOf = (s: string) => s.replace(/[\d,\s]/g, '');
const F: Record<string, number> = { 'kg g': 1000, 'l ml': 1000, 'm cm': 100, 'cm mm': 10 };

describe('y3-measures (#1097)', () => {
  it('is registered once, in Year 3 maths, first in the measure strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-measures')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('maths');
    expect(TOPICS.filter(t => t.year === 'year3' && /^y3-(measures|perimeter)$/.test(t.id)).map(t => t.id)).toEqual(['y3-measures', 'y3-perimeter']);
  });

  it('d1: a 6-tick scale from 0 with ends, end at most 500, no labels, answer is the mark in one unit', () => {
    for (const q of draws(1)) {
      const v = q.visual;
      if (v?.type !== 'numberline') throw new Error('not a number line');
      expect(v.from).toBe(0);
      expect(v.ends).toBe(true);
      expect(v.to).toBe(v.step! * 5);
      expect(v.to).toBeLessThanOrEqual(500);
      expect('labels' in v).toBe(false);
      expect(val(q.answer)).toBe(v.mark);
      expect(new Set(q.options.map(unitOf)).size, q.prompt).toBe(1);
    }
  });

  it('d2: one unit per card; the sum, difference or largest/smallest is recomputed', () => {
    let calc = 0, cmp = 0;
    for (const q of draws(2)) {
      const m = q.prompt.match(/^([\d,]+) (\w+) ([+−]) ([\d,]+) (\w+) = \?$/);
      if (!m) { cmp++; expect(q.options.every(o => !/\d/.test(o))).toBe(true); continue; }
      calc++;
      expect(m[2]).toBe(m[5]);
      const a = val(m[1]), b = val(m[4]);
      expect(val(q.answer), q.prompt).toBe(m[3] === '+' ? a + b : a - b);
      expect(val(q.answer)).toBeLessThanOrEqual(1000);
      expect(val(q.answer)).toBeGreaterThan(0);
      expect(unitOf(q.answer)).toBe(m[2]);
      for (const o of q.options) expect(unitOf(o)).toBe(m[2]);
    }
    expect(calc).toBeGreaterThan(100);
    expect(cmp).toBeGreaterThan(50);
  });

  it('d3: the converted total uses the right factor for each unit pair', () => {
    const seen = new Set<string>();
    for (const q of draws(3)) {
      const m = q.prompt.match(/^(\d+) (\w+)(?: and (\d+) (\w+))? = \? (\w+)$/)!;
      const small = m[5], big = m[2], f = F[`${big} ${small}`];
      expect(f, q.prompt).toBeDefined();
      seen.add(`${big} ${small}`);
      expect(val(q.answer), q.prompt).toBe(Number(m[1]) * f + Number(m[3] ?? 0));
      if (m[4]) expect(m[4]).toBe(small);
      for (const o of q.options) expect(unitOf(o)).toBe(small);
    }
    expect(seen.size).toBe(4);
  });

  it('options are distinct and the answer is among them, at every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(q.options.length);
      expect(q.options).toContain(q.answer);
      for (const o of q.options.filter(x => /\d/.test(x))) expect(val(o)).toBeGreaterThan(0);
    }
  });

  it('mixed units and conversions appear only at d3; d1 and d2 name one unit', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) expect(q.prompt, q.prompt).not.toMatch(/ and \d+ |= \? /);
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) expect(new Set(q.options.filter(o => /\d/.test(o)).map(unitOf)).size).toBeLessThanOrEqual(1);
  });

  it('each measure appears at d1 and at d2', () => {
    const d1 = draws(1).map(q => unitOf(q.answer));
    for (const u of ['mm', 'g', 'ml']) expect(d1).toContain(u);
    const d2 = draws(2).map(q => q.prompt + q.hint + q.say).join(' ');
    expect(d2).toMatch(/gram/); expect(d2).toMatch(/litre|millilitre/); expect(d2).toMatch(/metre|centimetre/);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: no decoy-leak above 0.30`, () => {
      const s = leakShares(topic.gen, d, 2000, { skipLeading: false });
      if (s.counted > 0) { expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3); }
    });
  }
});

describe('the measured thing is on the card (#2271)', () => {
  const ICON: Record<string, string> = { mm: '📏', g: '🌾', ml: '🥛' };
  it('each scale prompt leads with its instrument\'s icon and its spoken line is the same words without it', () => {
    for (const q of draws(1)) {
      const icon = ICON[q.answer.split(' ')[1]];
      expect(q.prompt.startsWith(`${icon} `), q.prompt).toBe(true);
      expect(q.say).toContain(q.prompt.slice(icon.length + 1));
      expect(q.say).not.toContain(icon);
    }
  });
});
