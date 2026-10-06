import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { carryCount, shortCarries, droppedCarries } from '../../src/curriculum/year4-shortmult';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-shortmult')!;
const num = (s: string) => parseNum(s)!.v;
const draw = (d: Difficulty, n: number) => { const r = rng(1140 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const SUM = /^([\d,]+) × (\d) = \?$/;
const launched = (q: { sequence?: string[]; options: string[] }) => q.sequence!.length + q.options.length - new Set(q.sequence).size;
const parse = (p: string) => { const m = p.match(SUM)!; return { a: num(m[1]), m: Number(m[2]) }; };

describe('y4-shortmult (#1140)', () => {
  it('is registered for Year 4 with sequence draws from d2', () => {
    expect(topic.year).toBe('year4'); expect(topic.sequenceFrom).toBe(2);
  });

  it('counts carries column by column', () => {
    expect(carryCount(24, 3)).toBe(1);
    expect(carryCount(34, 6)).toBe(2);
    expect(carryCount(11, 3)).toBe(0);
    expect(shortCarries(34, 6)).toEqual([2, 2]);
  });

  it('d1: pick-one only, 2-digit × 1-digit, one carry, the dropped carry offered', () => {
    for (const q of draw(1, 300)) {
      const { a, m } = parse(q.prompt);
      expect(a).toBeGreaterThanOrEqual(10); expect(a).toBeLessThanOrEqual(99);
      expect(m).toBeGreaterThanOrEqual(2); expect(m).toBeLessThanOrEqual(9);
      expect(carryCount(a, m)).toBe(1);
      expect(num(q.answer)).toBe(a * m);
      expect(q.sequence).toBeUndefined();
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      const wrong = q.options.filter(o => o !== q.answer).map(num);
      const dropped = droppedCarries(a, m);
      expect(wrong.some(w => dropped.includes(w))).toBe(true);
    }
  });

  it('d2: mixes pick-one (2-digit, carries) and build (3-digit, one carry, ≤4 slots, 6 bubbles)', () => {
    let picks = 0, builds = 0;
    for (const q of draw(2, 400)) {
      const { a, m } = parse(q.prompt);
      expect(num(q.answer)).toBe(a * m);
      if (!q.sequence) {
        picks++;
        expect(a).toBeLessThanOrEqual(99); expect(carryCount(a, m)).toBeGreaterThanOrEqual(1);
        const dropped = droppedCarries(a, m);
        expect(q.options.filter(o => o !== q.answer).map(num).some(w => dropped.includes(w))).toBe(true);
      } else {
        builds++;
        expect(a).toBeGreaterThanOrEqual(100); expect(carryCount(a, m)).toBe(1);
        expect(q.sequence.length).toBeLessThanOrEqual(4);
        expect(q.sequence).toEqual(q.answer.replace(',', '').split(''));
        expect(launched(q)).toBe(6);
      }
    }
    expect(picks).toBeGreaterThan(100); expect(builds).toBeGreaterThan(100);
  });

  it('d3: build only, 3-digit × 1-digit, two or more carries, answer ≤ 8,991', () => {
    for (const q of draw(3, 300)) {
      const { a, m } = parse(q.prompt);
      expect(a).toBeGreaterThanOrEqual(100); expect(carryCount(a, m)).toBeGreaterThanOrEqual(2);
      expect(num(q.answer)).toBe(a * m); expect(a * m).toBeLessThanOrEqual(8991);
      expect(q.sequence!.length).toBeLessThanOrEqual(4);
      expect(q.build!.template).toBe(q.answer.length === 5 ? '_,___' : '___');
      expect(launched(q)).toBe(6);
    }
  });

  it.each([1, 2] as const)('d%i pick-one cards do not leak by a unique units or leading digit', d => {
    // Build cards' options are digits, not answers: the leak rule is about the pick-one cards only.
    const pickOnly: typeof topic.gen = (dd, r) => { for (;;) { const c = topic.gen(dd, r); if (!c.sequence) return c; } };
    const s = leakShares(pickOnly, d, 2000);
    expect(s.counted).toBeGreaterThan(1900);
    expect(s.units / s.counted).toBeLessThanOrEqual(0.3);
    expect(s.leading / s.counted).toBeLessThanOrEqual(0.3);
  });
});
