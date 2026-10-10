import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { equal, parseFrac, mul, simplify, type Frac } from '../../src/curriculum/fractions';
import { ks2Solve } from './helpers/ks2-oracle';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-fracmult')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1262 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const fr = (s: string) => parseFrac(s)!;
const lowest = (f: Frac) => gcd(f.n, f.d) === 1;
/** Lowest terms by the label as written (`parseFrac` simplifies, so it cannot tell). */
const labelLowest = (o: string) => { const [n, d] = o.split('/').map(Number); return gcd(n, d) === 1; };
/** The two fractions in a prompt, in reading order. */
const factors = (prompt: string) => (prompt.match(/\d+\/\d+/g) ?? []).map(fr);

describe('y6-fracmult (#1262)', () => {
  it('is a Year 6 fractions topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'fractions']);
  });

  it("the NC's 1/4 × 1/2 = 1/8, plus others, through the oracle", () => {
    const table: [string, string][] = [['1/4 × 1/2', '1/8'], ['2/3 × 3/5', '2/5'], ['3/4 × 2/5', '3/10'], ['1/3 × 1/3', '1/9']];
    for (const [text, want] of table) expect(equal(ks2Solve(`${text} = ?`)!, fr(want)), text).toBe(true);
  });

  it('oracle: the answer is the product, a proper fraction in lowest terms, with four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const [a, b] = factors(c.prompt);
      const ans = fr(c.answer);
      expect(equal(ans, mul(a, b)), c.prompt).toBe(true);
      if (d < 3) expect(equal(ks2Solve(c.prompt)!, ans), c.prompt).toBe(true);
      expect(lowest(ans) && ans.n < ans.d, c.prompt).toBe(true);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('exactly one option is both equal in value to the product and in lowest terms', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const [a, b] = factors(c.prompt), want = mul(a, b);
      const hits = c.options.filter(o => { const f = fr(o); return equal(f, want) && labelLowest(o); });
      expect(hits, c.prompt).toHaveLength(1);
      for (const o of c.options) { const f = fr(o); expect(f.d, o).toBeGreaterThan(1); }
    }
  });

  it('d1 is unit × unit with denominators 2–10; d2 simplifies on at least half the cards', () => {
    for (const c of draw(1)) for (const f of factors(c.prompt)) { expect(f.n).toBe(1); expect(f.d).toBeGreaterThanOrEqual(2); expect(f.d).toBeLessThanOrEqual(10); }
    const cards = draw(2);
    const simplifies = cards.filter(c => { const [a, b] = factors(c.prompt); return gcd(a.n * b.n, a.d * b.d) > 1; }).length;
    expect(simplifies / cards.length).toBeGreaterThanOrEqual(0.5);
  });

  it('d2 offers the unsimplified product when it differs, and a card carries the slips', () => {
    let unsimplified = 0, added = 0, crossed = 0;
    for (const c of draw(2)) {
      const [a, b] = factors(c.prompt), want = simplify({ n: a.n * b.n, d: a.d * b.d });
      const raw = `${a.n * b.n}/${a.d * b.d}`;
      if (raw !== c.answer && c.options.includes(raw)) unsimplified++;
      if (c.options.includes(`${a.n * b.n}/${a.d + b.d}`)) added++;
      if (c.options.includes(`${a.n * b.d}/${a.d * b.n}`) && !equal(fr(`${a.n * b.d}/${a.d * b.n}`), want)) crossed++;
    }
    expect(unsimplified).toBeGreaterThan(60); expect(added).toBeGreaterThan(30); expect(crossed).toBeGreaterThan(30);
  });

  it('d3 is a story with two fractions, slow, and a spoken form', () => {
    for (const c of draw(3)) {
      expect(factors(c.prompt)).toHaveLength(2);
      for (const f of factors(c.prompt)) { expect(lowest(f)).toBe(true); expect(f.d).toBeLessThanOrEqual(6); }
      expect(c.slow).toBe(true);
    }
  });

  it('say reads no raw fraction', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 60)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say).not.toMatch(/\d+\/\d+/);
      expect(sayIsSafe(c.say!), c.say).toBe(true);
    }
  });
});
