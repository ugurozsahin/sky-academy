import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-round')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1177 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const parse = (prompt: string) => { const m = prompt.match(/^Round ([\d,]+) to the nearest ([\d,]+)$/)!; return { n: num(m[1]), p: num(m[2]) }; };

describe('y5-round (#1177)', () => {
  it('is registered for Year 5', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); });

  it('the answer is Math.round(n / p) * p with commas, on every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      const { n, p } = parse(q.prompt);
      expect(num(q.answer)).toBe(Math.round(n / p) * p);
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(o).toMatch(/^\d{1,3}(,\d{3})*$/); expect(num(o)).toBeLessThanOrEqual(1000000); });
      expect(q.say).toMatch(/nearest (ten|hundred|thousand|ten thousand|hundred thousand)$/);
    }
  });

  it('the ladder: d1 four digits to 10/100, d2 five or six digits to 1,000/10,000, d3 reaches 100,000, 5s and carries', () => {
    for (const q of draw(1, 300)) { const { n, p } = parse(q.prompt); expect(n).toBeGreaterThanOrEqual(1000); expect(n).toBeLessThanOrEqual(9999); expect([10, 100]).toContain(p); }
    for (const q of draw(2, 300)) { const { n, p } = parse(q.prompt); expect(n).toBeGreaterThanOrEqual(10000); expect(n).toBeLessThanOrEqual(999999); expect([1000, 10000]).toContain(p); }
    const ps = new Set<number>(); let top = 0;
    for (const q of draw(3, 600)) { const { p } = parse(q.prompt); ps.add(p); if (p === 100000) top++; }
    expect([...ps].sort((a, b) => a - b)).toEqual([10, 100, 1000, 10000, 100000]);
    expect(top).toBeGreaterThan(100);
  });

  it('d3 shows the half-way case (the deciding digit is 5, so it rounds up) and the carry case (99,960 → 100,000)', () => {
    let half = 0, carry = 0;
    for (const q of draw(3, 800)) {
      const { n, p } = parse(q.prompt), a = num(q.answer);
      if (Math.floor((n % p) / (p / 10)) === 5 && p > 10 ? true : n % 10 === 5 && p === 10) { half++; expect(a).toBe(n - (n % p) + p); }
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

  it('leak limit: at most 30% of cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(1900);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});
