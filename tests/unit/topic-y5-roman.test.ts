import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { fromRoman, isRoman, toRoman } from '../../src/curriculum/roman';
import { leakShares } from './helpers/decoy-leak';
import { labelEm, rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-roman')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1181_000 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const card = (q: Question) => (q.visual?.type === 'word' ? q.visual.text : '');
const isRead = (q: Question) => isRoman(card(q));
const ALL = ([1, 2, 3] as Difficulty[]);

describe('y5-roman (#1181)', () => {
  it('is registered once in Year 5 maths', () => {
    expect(TOPICS.filter(t => t.id === 'y5-roman')).toHaveLength(1);
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths');
  });

  it('oracle: the canonical numeral on the card converts to the answer; exactly one option is right', () => {
    for (const d of ALL) for (const q of draws(d, 2000)) {
      if (isRead(q)) {
        const v = fromRoman(card(q))!;
        expect(toRoman(v)).toBe(card(q));
        expect(q.answer, q.answer).toMatch(d === 3 ? /^\d{4}$/ : /^\d{1,3}(,\d{3})*$/);
        expect(q.answer.replace(/,/g, '')).toBe(String(v));
        expect(q.options.filter(o => o === q.answer)).toHaveLength(1);
        for (const o of q.options) expect(o, o).toMatch(d === 3 ? /^\d{4}$/ : /^\d{1,3}(,\d{3})*$/);
        expect(new Set(q.options).size).toBe(q.options.length);
      } else {
        const v = Number(q.prompt.match(/\d+/)![0]);
        expect(fromRoman(q.answer)).toBe(v);
        expect(q.options.filter(o => fromRoman(o) === v)).toHaveLength(1);
        for (const o of q.options) expect(isRoman(o), o).toBe(true);
      }
    }
  });

  it('ladder: d1 to C, d2 to M with some reversed cards, d3 years 1066 to 2030 with no comma', () => {
    for (const q of draws(1)) { expect(isRead(q)).toBe(true); expect(Number(q.answer)).toBeLessThanOrEqual(100); }
    const d2 = draws(2, 1000);
    expect(d2.some(q => !isRead(q))).toBe(true);
    expect(d2.some(q => isRead(q) && Number(q.answer) > 500)).toBe(true);
    const frac = d2.filter(q => !isRead(q)).length / d2.length;
    expect(frac).toBeGreaterThan(0.15); expect(frac).toBeLessThan(0.35);
    for (const q of draws(3)) {
      expect(isRead(q)).toBe(true);
      expect(q.answer).toMatch(/^\d{4}$/);
      expect(Number(q.answer)).toBeGreaterThanOrEqual(1066); expect(Number(q.answer)).toBeLessThanOrEqual(2030);
      for (const o of q.options) expect(o).toMatch(/^\d{4}$/);
    }
  });

  it('every card has four distinct options, over many seeds (a short fallback pool once left a write card with three)', () => {
    for (const d of ALL) for (const seed of [1, 2, 3, 4]) {
      const r = rng(1181_500 + seed * 10 + d);
      for (let i = 0; i < 3000; i++) { const q = topic.gen(d, r); expect(new Set(q.options).size, `${q.prompt} ${q.options}`).toBe(4); }
    }
  });

  it('decoys: a pair read the wrong way round is an option (XL as 60)', () => {
    const qs = draws(1, 6000);
    expect(qs.filter(q => card(q) === 'XL').every(q => q.options.includes('60'))).toBe(true);
    expect(qs.filter(q => card(q) === 'XL').length).toBeGreaterThan(0);
  });

  it('misreading decoys: a subtractive pair read as adding is an option (XIX as 21, MCMXCIX as 2221)', () => {
    const q19 = draws(1, 3000).filter(q => card(q) === 'XIX');
    expect(q19.length).toBeGreaterThan(0);
    expect(q19.every(q => q.options.includes('21'))).toBe(true);
    const q99 = draws(3, 6000).filter(q => card(q) === 'MCMXCIX');
    expect(q99.length).toBeGreaterThan(0);
    expect(q99.every(q => q.options.includes('2221'))).toBe(true);
  });

  it('Roman bubble labels are at most 3.96 em; long numerals stay on the card', () => {
    for (const q of draws(2, 2000)) if (!isRead(q)) for (const o of [...q.options]) expect(labelEm(o), o).toBeLessThanOrEqual(3.96);
    expect(draws(2, 3000).some(q => isRead(q) && labelEm(card(q)) > 3.96)).toBe(true);
  });

  it('say spells the letters, never a raw numeral', () => {
    for (const d of ALL) for (const q of draws(d)) {
      expect(q.say, q.prompt).toBeDefined();
      expect(q.say!, q.prompt).not.toMatch(/\b[IVXLCDM]{2,}\b/);
      if (isRead(q)) expect(q.say).toContain('Roman numeral ');
    }
  });

  it('labels pass R-LBL', () => {
    for (const d of ALL) for (const q of draws(d)) expect(rLblProblem(q), `${d} ${q.answer}`).toBeNull();
  });

  it('the KS2 leak limit holds on every difficulty', () => {
    for (const d of ALL) { const s = leakShares(topic.gen, d, 2000); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
