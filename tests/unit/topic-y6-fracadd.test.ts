import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-fracadd')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1261 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Independent integer oracle: no import from fractions.ts. */
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const parse = (s: string) => { const m = /^(?:(\d+) )?(?:(\d+)\/(\d+)|(\d+))$/.exec(s)!; return m[4] !== undefined ? { n: Number(m[4]), d: 1 } : { n: Number(m[1] ?? 0) * Number(m[3]) + Number(m[2]), d: Number(m[3]) }; };
const operands = (prompt: string) => { const m = /^(.+?) ([+−]) (.+?) = \?$/.exec(prompt)!; return { a: parse(m[1]), b: parse(m[3]), plus: m[2] === '+', as: m[1], bs: m[3] }; };
const solve = (prompt: string) => { const { a, b, plus } = operands(prompt); return { n: a.n * b.d + (plus ? 1 : -1) * b.n * a.d, d: a.d * b.d }; };
const same = (x: { n: number; d: number }, y: { n: number; d: number }) => x.n * y.d === y.n * x.d;
const denom = (s: string) => Number(/\/(\d+)$/.exec(s)![1]);

describe('y6-fracadd (#1261)', () => {
  it('is a Year 6 fractions topic', () => {
    expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'fractions' });
  });

  it('fixed cases: 1/2 + 1/8 = 5/8 and 2 1/3 + 1 3/4 = 4 1/12', () => {
    expect(draw(1, 6000).some(q => q.prompt === '1/2 + 1/8 = ?' && q.answer === '5/8')).toBe(true);
    expect(draw(3, 20000).some(q => q.prompt === '2 1/3 + 1 3/4 = ?' && q.answer === '4 1/12')).toBe(true);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the answer matches exact arithmetic, in lowest terms, mixed above 1, positive`, () => {
      for (const q of draw(d)) {
        const want = solve(q.prompt), got = parse(q.answer);
        expect(same(want, got), q.prompt).toBe(true);
        expect(want.n, q.prompt).toBeGreaterThan(0);
        expect(gcd(got.n, got.d), q.prompt).toBe(1);
        expect(/^\d+\/\d+$/.test(q.answer) ? got.n < got.d : true, q.prompt).toBe(true);
        expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      }
    });

    it(`d${d}: no decoy is worth the answer, and every decoy is positive`, () => {
      for (const q of draw(d)) {
        const want = solve(q.prompt);
        for (const o of q.options.filter(o => o !== q.answer)) { expect(same(parse(o), want), `${q.prompt} ${o}`).toBe(false); expect(parse(o).n).toBeGreaterThan(0); }
      }
    });

    it(`d${d}: say is safe`, () => {
      for (const q of draw(d)) expect(sayIsSafe(q.say ?? q.prompt), q.prompt).toBe(true);
    });
  }

  it('d1 denominators are related, d2 unrelated, both at most 12 with a common multiple of at most 60', () => {
    for (const d of [1, 2] as const) for (const q of draw(d)) {
      const { as, bs } = operands(q.prompt), p = denom(as), r = denom(bs);
      expect(p !== r && (p % r === 0 || r % p === 0), q.prompt).toBe(d === 1);
      expect(Math.max(p, r)).toBeLessThanOrEqual(12);
      expect(p / gcd(p, r) * r).toBeLessThanOrEqual(60);
      if (d === 1) expect(solve(q.prompt).n).toBeLessThan(solve(q.prompt).d);
    }
  });

  it('d3 operands are mixed numbers with whole parts 1–5', () => {
    for (const q of draw(3)) {
      const { as, bs } = operands(q.prompt);
      for (const s of [as, bs]) { const w = /^(\d+) \d+\/\d+$/.exec(s); expect(w, q.prompt).not.toBeNull(); expect(Number(w![1])).toBeGreaterThanOrEqual(1); expect(Number(w![1])).toBeLessThanOrEqual(5); }
    }
  });

  it('d1–d2 offer tops-and-bottoms (1/2 + 1/8 → 2/10) whenever it is a valid proper fraction', () => {
    let seen = 0;
    for (const d of [1, 2] as const) for (const q of draw(d)) {
      const { a, b, plus } = operands(q.prompt);
      if (!plus) continue;
      seen++;
      expect(q.options, q.prompt).toContain(`${a.n + b.n}/${a.d + b.d}`);
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('d3 offers the dropped carry on addition', () => {
    let carries = 0;
    for (const q of draw(3)) {
      const { a, b, plus } = operands(q.prompt);
      if (!plus) continue;
      const wa = Math.trunc(a.n / a.d), wb = Math.trunc(b.n / b.d), fn = (a.n - wa * a.d) * b.d + (b.n - wb * b.d) * a.d;
      if (fn >= a.d * b.d) { carries++; const want = solve(q.prompt); expect(q.options.some(o => same(parse(o), { n: want.n - want.d, d: want.d })), q.prompt).toBe(true); }
    }
    expect(carries).toBeGreaterThan(20);
  });
});
