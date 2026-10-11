import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { equal, parseFrac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-fracdiv')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1263 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const fr = (s: string) => parseFrac(s)!;
/** The oracle, integers only: a/b ÷ k = a/(b·k) over its gcd. Reads the first fraction and the divisor out of the prompt. */
function solve(prompt: string): { n: number; d: number; a: number; b: number; k: number } {
  const [, a, b] = prompt.match(/(\d+)\/(\d+)/)!.map(Number);
  const k = Number(prompt.includes('÷') ? prompt.match(/÷ (\d+)/)![1] : prompt.match(/(\d+) (?:friends|children|equal|buckets|strips|beds)/)![1]);
  const g = gcd(a, b * k);
  return { n: a / g, d: b * k / g, a, b, k };
}

describe('y6-fracdiv (#1263)', () => {
  it('is a Year 6 fractions topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'fractions']);
  });

  it("the NC's 1/3 ÷ 2 = 1/6, plus others", () => {
    const table: [string, string][] = [['1/3 ÷ 2 = ?', '1/6'], ['4/5 ÷ 2 = ?', '2/5'], ['3/4 ÷ 2 = ?', '3/8'], ['2/3 ÷ 4 = ?', '1/6']];
    for (const [p, want] of table) { const s = solve(p); expect(`${s.n}/${s.d}`, p).toBe(want); }
  });

  it('oracle: the answer is the quotient in lowest terms, with four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const s = solve(c.prompt), [n, dd] = c.answer.split('/').map(Number);
      expect([n, dd], c.prompt).toEqual([s.n, s.d]);
      expect(gcd(n, dd), c.prompt).toBe(1);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('no decoy equals the answer in value or is a whole number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) for (const o of c.options) {
      if (o === c.answer) continue;
      expect(equal(fr(o), fr(c.answer)), c.prompt).toBe(false);
      const [n, dd] = o.split('/').map(Number); expect(n % dd, o).not.toBe(0);
    }
  });

  it('every option is in lowest terms and no two options are equal in value', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 1000)) {
      for (const o of c.options) { const [n, dd] = o.split('/').map(Number); expect(gcd(n, dd), `${c.prompt} ${o}`).toBe(1); }
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(equal(fr(c.options[i]), fr(c.options[j])), `${c.prompt} ${c.options}`).toBe(false);
    }
  });

  it('the multiply-instead decoy is on every card where it differs from the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const s = solve(c.prompt), wrong = { n: s.a * s.k, d: s.b };
      if (wrong.n % wrong.d === 0 || equal(wrong, fr(c.answer))) continue;
      expect(c.options.some(o => equal(fr(o), wrong)), c.prompt).toBe(true);
    }
  });

  it('d1 is a unit fraction (denominator 2–10) ÷ 2–6', () => {
    for (const c of draw(1)) { const s = solve(c.prompt); expect(s.a).toBe(1); expect(s.b).toBeGreaterThanOrEqual(2); expect(s.b).toBeLessThanOrEqual(10); expect(s.k).toBeGreaterThanOrEqual(2); expect(s.k).toBeLessThanOrEqual(6); }
  });

  it('d2 is non-unit and draws both kinds, each 30–70 %', () => {
    const cards = draw(2).map(c => solve(c.prompt));
    for (const s of cards) expect(s.a).toBeGreaterThan(1);
    const exact = cards.filter(s => s.a % s.k === 0).length / cards.length;
    expect(exact).toBeGreaterThanOrEqual(0.3); expect(exact).toBeLessThanOrEqual(0.7);
  });

  it('d3 is a slow sharing story with a spoken form from a bank of at most 6', () => {
    const cards = draw(3);
    for (const c of cards) { expect(c.slow).toBe(true); solve(c.prompt); }
    expect(new Set(cards.map(c => c.prompt.replace(/\d+/g, '#'))).size).toBeLessThanOrEqual(6);
  });

  it('say reads no raw fraction', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 60)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say).not.toMatch(/\d+\/\d+/);
      expect(sayIsSafe(c.say!), c.say).toBe(true);
    }
  });
});
