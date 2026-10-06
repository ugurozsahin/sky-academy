import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { family } from '../../src/curriculum/year4-fracequiv';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-fracequiv')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1142 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const parts = (s: string) => s.split('/').map(Number) as [number, number];
// Independent of fractions.ts: cross-multiplication.
const same = (a: string, b: string) => { const [an, ad] = parts(a), [bn, bd] = parts(b); return an * bd === bn * ad; };
const NAMED = /^Slice every fraction equal to (\d\/\d)$/;
const MISSING = /^(\d\/\d) = \?\/(\d+)$/;

describe('y4-fracequiv (#1142)', () => {
  it('is registered for Year 4 with sequence draws from d2', () => {
    expect(topic.year).toBe('year4'); expect(topic.sequenceFrom).toBe(2);
  });

  it('family() lists equal fractions over 12 or less, never the fraction itself', () => {
    expect(family({ n: 1, d: 2 }).map(f => `${f.n}/${f.d}`)).toEqual(['2/4', '3/6', '4/8', '5/10', '6/12']);
    expect(family({ n: 1, d: 5 }).map(f => `${f.n}/${f.d}`)).toEqual(['2/10']);
  });

  it('d1: a two-bar stack shading the same value; the answer is the bottom bar', () => {
    for (const q of draw(1, 300)) {
      const v = q.visual as { type: string; parts: number; shaded: number; stack: { parts: number; shaded: number }[] };
      expect(v.type).toBe('fraction'); expect(v.stack).toHaveLength(2);
      const [top, bottom] = v.stack;
      expect(top).toEqual({ parts: v.parts, shaded: v.shaded });
      expect(top.shaded).toBe(1); expect(bottom.parts).toBeLessThanOrEqual(12);
      expect(top.shaded * bottom.parts).toBe(bottom.shaded * top.parts);
      expect(q.answer).toBe(`${bottom.shaded}/${bottom.parts}`);
      expect(q.sequence).toBeUndefined();
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      for (const o of q.options.filter(o => o !== q.answer)) expect(same(o, q.answer)).toBe(false);
      for (const o of q.options) expect(o.length).toBeLessThanOrEqual(5);
    }
  });

  it.each([2, 3] as const)('d%i any-order cards: targets equal the named fraction, decoys do not, a decoy shares a bottom', d => {
    let slice = 0;
    for (const q of draw(d, 400)) {
      const m = q.prompt.match(NAMED);
      if (!m) continue;
      slice++;
      const name = m[1], targets = q.sequence!, decoys = q.options.filter(o => !targets.includes(o));
      expect(q.anyOrder).toBe(true);
      expect(targets.length).toBeGreaterThanOrEqual(2); expect(targets.length).toBeLessThanOrEqual(3);
      expect(decoys).toHaveLength(2);
      expect(new Set(q.options).size).toBe(q.options.length);
      for (const t of targets) { expect(same(t, name)).toBe(true); expect(t).not.toBe(name); expect(parts(t)[1]).toBeLessThanOrEqual(12); }
      for (const x of decoys) expect(same(x, name)).toBe(false);
      expect(decoys.some(x => targets.some(t => parts(t)[1] === parts(x)[1]))).toBe(true);
      for (const o of q.options) expect(o.length).toBeLessThanOrEqual(5);
      expect(q.say).not.toMatch(/\d/);
    }
    expect(slice).toBeGreaterThan(250);
  });

  it('d2 only names 1/2, 1/3 and 1/4; d3 names the wider families', () => {
    const names = (d: Difficulty) => new Set(draw(d, 400).map(q => q.prompt.match(NAMED)?.[1]).filter(Boolean));
    expect([...names(2)].sort()).toEqual(['1/2', '1/3', '1/4']);
    expect([...names(3)].sort()).toEqual(['1/2', '1/3', '1/4', '2/3', '3/4']);
  });

  it('d3: about one card in four is a missing-number card that makes the fractions equal', () => {
    let missing = 0;
    const qs = draw(3, 600);
    for (const q of qs) {
      const m = q.prompt.match(MISSING);
      if (!m) continue;
      missing++;
      expect(same(`${q.answer}/${m[2]}`, m[1])).toBe(true);
      expect(q.sequence).toBeUndefined();
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      for (const o of q.options.filter(o => o !== q.answer)) expect(same(`${o}/${m[2]}`, m[1])).toBe(false);
      expect(q.say).not.toMatch(/\d/);
    }
    expect(missing).toBeGreaterThan(90); expect(missing).toBeLessThan(220);
  });

  it('d3 missing-number cards offer the add-the-difference slip (2/3 = ?/12 → 11)', () => {
    const slip = draw(3, 800).filter(q => MISSING.test(q.prompt)).filter(q => {
      const [, n, d, D] = q.prompt.match(/^(\d)\/(\d) = \?\/(\d+)$/)!.map(Number) as number[];
      return q.options.includes(String(n + (D - d)));
    });
    expect(slip.length).toBeGreaterThan(0);
  });

  it('speech never carries a raw fraction at any level', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 200)) expect(q.say ?? '').not.toMatch(/\d\/\d/);
  });
});
