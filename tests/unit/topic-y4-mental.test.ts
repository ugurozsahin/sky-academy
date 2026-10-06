import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-mental')!;
const num = (s: string) => parseNum(s)!.v;
const draw = (d: Difficulty, n: number, seed = 1138) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Evaluate "a × b × c = ?" or "a ÷ b = ?" left to right. */
function evalCard(prompt: string): { nums: number[]; ops: string[]; value: number } {
  const parts = prompt.replace(' = ?', '').split(' ');
  const nums = parts.filter((_, i) => i % 2 === 0).map(num), ops = parts.filter((_, i) => i % 2 === 1);
  const value = ops.reduce((acc, op, i) => op === '×' ? acc * nums[i + 1] : acc / nums[i + 1], nums[0]);
  return { nums, ops, value };
}
const opts = (q: { options: string[]; answer: string }) => q.options.filter(o => o !== q.answer).map(num);

describe('y4-mental (#1138)', () => {
  it('is registered for Year 4 maths', () => {
    expect(topic.year).toBe('year4'); expect(topic.subject).toBe('maths');
  });

  it.each([1, 2, 3] as const)('d%i: the oracle holds, four distinct non-negative whole options', d => {
    for (const q of draw(d, 400)) {
      const { value } = evalCard(q.prompt);
      expect(num(q.answer)).toBe(value);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(num(o)).toBeGreaterThanOrEqual(0); expect(Number.isInteger(num(o))).toBe(true); }
      expect(q.say).toBeTruthy();
    }
  });

  it('d1 draws × 0, × 1 and ÷ 1 with the number 10–999, and each decoy rule holds', () => {
    const seen = { zero: 0, one: 0, div: 0 };
    for (const q of draw(1, 400)) {
      const { nums, ops } = evalCard(q.prompt);
      const n = Math.max(...nums), wrong = opts(q);
      if (ops[0] === '÷') { seen.div++; expect(nums[1]).toBe(1); }
      else if (nums.includes(0)) { seen.zero++; expect(wrong).toContain(n); expect(q.answer).toBe('0'); }
      else { seen.one++; expect(nums).toContain(1); }
      expect(n).toBeGreaterThanOrEqual(10); expect(n).toBeLessThanOrEqual(999);
      if (ops[0] === '÷' || !nums.includes(0)) {
        expect(wrong).toContain(0); expect(wrong).toContain(n + 1);
        expect(wrong.some(w => Math.abs(w - n) === 10)).toBe(true);
      }
    }
    expect(seen.zero).toBeGreaterThan(80); expect(seen.one).toBeGreaterThan(80); expect(seen.div).toBeGreaterThan(80);
  });

  it('d2 derives from a table fact and a power of ten, with the place-value shifts as decoys, products ≤ 3,600', () => {
    let mul = 0, div = 0;
    for (const q of draw(2, 400)) {
      const { nums, ops, value } = evalCard(q.prompt);
      expect(ops).toHaveLength(1);
      const wrong = opts(q);
      expect(wrong).toContain(value * 10); expect(wrong).toContain(value / 10);
      if (ops[0] === '×') { mul++; expect(value).toBeLessThanOrEqual(3600); expect(nums.some(v => v >= 20 && v % 10 === 0)).toBe(true); }
      else { div++; expect(nums[0]).toBeLessThanOrEqual(3600); }
    }
    expect(mul).toBeGreaterThan(100); expect(div).toBeGreaterThan(100);
  });

  it('d3 has three factors with a pair making 10, 20 or 100, answers ≤ 1,200, and a two-number product decoy', () => {
    for (const q of draw(3, 400)) {
      const { nums, ops, value } = evalCard(q.prompt);
      expect(ops).toEqual(['×', '×']);
      expect(value).toBeLessThanOrEqual(1200);
      const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
      expect(pairs.some(([i, j]) => [10, 20, 100].includes(nums[i] * nums[j]))).toBe(true);
      const twoProducts = pairs.map(([a, b]) => nums[a] * nums[b]);
      expect(opts(q).some(w => twoProducts.includes(w))).toBe(true);
    }
  });

  it.each([1, 2, 3] as const)('d%i: ≤30 % of cards with an answer ≥ 20 have a unique units or leading digit', d => {
    const cards = draw(d, 2000, 7).filter(q => num(q.answer) >= 20);
    expect(cards.length).toBeGreaterThan(900);
    const digits = (s: string) => s.replace(/,/g, '');
    const unique = (q: typeof cards[0], pick: (s: string) => string) => q.options.filter(o => pick(digits(o)) === pick(digits(q.answer))).length === 1;
    expect(cards.filter(q => unique(q, s => s.slice(-1))).length / cards.length).toBeLessThanOrEqual(0.3);
    expect(cards.filter(q => unique(q, s => s[0])).length / cards.length).toBeLessThanOrEqual(0.3);
  });

  it('writes four-digit numbers with a comma', () => {
    for (const q of draw(2, 400)) for (const o of [q.prompt, ...q.options]) expect(o).not.toMatch(/\d{4,}/);
  });
});
