import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-div10')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1147 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const DIV = /^(\d+) ÷ (10|100) = \?$/;
const DIGIT = /^(\d\d) ÷ (10|100) = (\d?\.?\d+)\. The (\d) is worth \d \.\.\.\?$/;
/** A label as { scaled integer, decimal places }, read from the digits (no float). */
const sc = (s: string) => { const [w, f = ''] = s.split('.'); return { v: Number(w + f), dp: f.length }; };
/** Quotient of n ÷ 10^k in the same form. */
const quot = (n: number, k: number) => ({ v: n, dp: k });
const dp = (s: string) => (s.split('.')[1] ?? '').length;

describe('y4-div10 (#1147)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  it('d1: a one-digit number ÷ 10, the oracle in scaled integers', () => {
    for (const q of draw(1, 300)) {
      const m = q.prompt.match(DIV)!, n = Number(m[1]);
      expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(9); expect(m[2]).toBe('10');
      expect(sc(q.answer)).toEqual(quot(n, 1));
    }
  });

  it('d2: one- or two-digit ÷ 10 or ÷ 100, never a trailing-zero number; both powers and both widths appear', () => {
    const qs = draw(2, 400);
    for (const q of qs) {
      const m = q.prompt.match(DIV)!, n = Number(m[1]);
      expect(n % 10).not.toBe(0); expect(n).toBeLessThanOrEqual(99);
      expect(sc(q.answer)).toEqual(quot(n, m[2] === '10' ? 1 : 2));
    }
    expect(qs.some(q => q.prompt.includes('÷ 100'))).toBe(true);
    expect(qs.some(q => q.prompt.includes('÷ 10 '))).toBe(true);
    expect(qs.some(q => Number(q.prompt.match(DIV)![1]) < 10)).toBe(true);
    expect(qs.some(q => Number(q.prompt.match(DIV)![1]) > 10)).toBe(true);
  });

  it('every number card has no float artefact, no label over 2 decimal places, 4 distinct positive options', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 300)) {
      if (!DIV.test(q.prompt)) continue;
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      q.options.forEach(o => { expect(o).toMatch(/^\d+(\.\d{1,2})?$/); expect(Number(o)).toBeGreaterThan(0); });
    }
  });

  it('every number card offers the wrong power of ten and a decoy with the answer\'s number of decimal places', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 400)) {
      const m = q.prompt.match(DIV); if (!m) continue;
      const n = Number(m[1]), k = m[2] === '10' ? 1 : 2, wrong = sc(q.options.find(o => sc(o).v === n && sc(o).dp === (k === 1 ? 2 : 1)) ?? '0');
      expect(wrong, q.prompt).toEqual(quot(n, k === 1 ? 2 : 1));
      expect(q.options.filter(o => o !== q.answer && dp(o) === dp(q.answer)).length, q.prompt).toBeGreaterThanOrEqual(1);
    }
  });

  it('d3: half are number cards; the rest ask a digit\'s value with 4 wide bubbles and the right place', () => {
    let digit = 0, num = 0;
    for (const q of draw(3, 800)) {
      const m = q.prompt.match(DIGIT);
      if (!m) { expect(q.prompt).toMatch(DIV); num++; continue; }
      digit++;
      const n = Number(m[1]), k = m[2] === '10' ? 1 : 2, d = Number(m[4]);
      expect(sc(m[3])).toEqual(quot(n, k));
      expect(Math.floor(n / 10)).not.toBe(n % 10);
      expect(q.wide).toBe(true); expect(q.options).toHaveLength(4);
      expect([...q.options].sort()).toEqual(['hundredths', 'ones', 'tens', 'tenths']);
      const tens = d === Math.floor(n / 10);
      expect(q.answer).toBe((['ones', 'tenths', 'hundredths'] as const)[(tens ? 0 : 1) + k - 1]);
    }
    expect(digit).toBeGreaterThan(300); expect(num).toBeGreaterThan(300);
  });

  it('speech carries no digit-point number or divide sign', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 200)) expect(q.say ?? '').not.toMatch(/\d\.\d|÷/);
  });

  it.each([1, 2] as const)('d%i leak shares stay at or under 30%% for the last and leading digit', d => {
    const s = leakShares(topic.gen, d, 2000);
    expect(s.counted).toBeGreaterThan(500);
    expect(s.units).toBeLessThanOrEqual(0.3);
    expect(s.leading).toBeLessThanOrEqual(0.3);
  });
});
