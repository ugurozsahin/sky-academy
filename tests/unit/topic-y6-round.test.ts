import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { CONTEXTS } from '../../src/curriculum/year6-round';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-round')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1212 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
/** n is the first number on the card and p the last, in both the plain and the context wording. */
const parse = (prompt: string) => { const m = prompt.match(/\d[\d,]*/g)!; return { n: num(m[0]), p: num(m[m.length - 1]) }; };

describe('y6-round (#1212)', () => {
  it('is registered for Year 6', () => { expect(topic.year).toBe('year6'); expect(topic.subject).toBe('maths'); });

  it('the answer is Math.round(n / p) * p, at most 10,000,000, on every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      const { n, p } = parse(q.prompt);
      expect(num(q.answer)).toBe(Math.round(n / p) * p);
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(o).toMatch(/^\d{1,3}(,\d{3})*$/); expect(num(o)).toBeLessThanOrEqual(10000000); });
      expect(q.say).toMatch(/nearest (thousand|ten thousand|hundred thousand|million)$/);
    }
  });

  it('the ladder: d1 six digits to 1,000/10,000, d2 seven digits to 10,000/100,000/1,000,000, d3 in context', () => {
    for (const q of draw(1, 300)) { const { n, p } = parse(q.prompt); expect(n).toBeGreaterThanOrEqual(100000); expect(n).toBeLessThanOrEqual(999999); expect([1000, 10000]).toContain(p); }
    const ps2 = new Set<number>();
    for (const q of draw(2, 300)) { const { n, p } = parse(q.prompt); expect(n).toBeGreaterThanOrEqual(1000000); expect(n).toBeLessThanOrEqual(9999999); ps2.add(p); }
    expect([...ps2].sort((a, b) => a - b)).toEqual([10000, 100000, 1000000]);
    for (const q of draw(3, 300)) expect(q.prompt).toMatch(/Nearest [\d,]+\?$/);
  });

  it('d3 prompts are at most 60 characters, even with the widest numbers', () => {
    for (const q of draw(3, 800)) expect(q.prompt.length).toBeLessThanOrEqual(60);
    for (const c of CONTEXTS) expect(c('9,999,999', '1,000,000').length).toBeLessThanOrEqual(60);
  });

  it('d3 shows the half-way case (rounds up) and the carry case (9,960,000 → 10,000,000)', () => {
    let half = 0, carry = 0;
    for (const q of draw(3, 1200)) {
      const { n, p } = parse(q.prompt), a = num(q.answer);
      if (Math.floor((n % p) / (p / 10)) === 5) { half++; expect(a).toBe(n - (n % p) + p); }
      if (String(a).length > String(n).length) { carry++; expect(a).toBe(10 ** String(n).length); }
    }
    expect(half).toBeGreaterThan(30); expect(carry).toBeGreaterThan(10);
  });

  it('the decoys are the slips: rounded the wrong way, and at the wrong place', () => {
    for (const q of draw(2, 300)) {
      const { n, p } = parse(q.prompt), a = num(q.answer);
      expect(q.options).toContain((a > n ? a - p : a + p).toLocaleString('en-GB'));
      const fine = Math.round(n / (p / 10)) * (p / 10);
      if (fine !== a) expect(q.options).toContain(fine.toLocaleString('en-GB'));
    }
  });

  it('a card with a label of seven or more digits is wide and has at most four bubbles', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.options.length).toBeLessThanOrEqual(4);
      if (q.options.some(o => o.replace(/,/g, '').length >= 7)) expect(q.wide).toBe(true);
    }
  });

  it('leak limit: at most 30% of cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(1900);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});
