import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { parseFrac } from '../../src/curriculum/fractions';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-simplify')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1260 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Independent integer oracles. */
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const lcm = (a: number, b: number) => a / gcd(a, b) * b;
const f = (s: string) => { const m = /^(?:(\d+) )?(\d+)\/(\d+)$/.exec(s)!; const d = Number(m[3]); return { n: Number(m[1] ?? 0) * d + Number(m[2]), d }; };
const same = (a: string, b: string) => f(a).n * f(b).d === f(b).n * f(a).d;
const lowest = (s: string) => gcd(f(s).n, f(s).d) === 1;
const fracs = (s: string) => s.match(/\d+\/\d+/g)!;

describe('y6-simplify (#1260)', () => {
  it('is a first-in-strand Year 6 fractions topic', () => {
    expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'fractions' });
    expect(TOPICS.filter(t => t.year === 'year6' && t.strand === 'fractions')[0].id).toBe('y6-simplify');
  });

  it('fixed cases: 12/18 → 2/3, and 12 for 3/4 and 5/6', () => {
    expect(draw(1, 600).some(q => q.prompt === 'Write 12/18 in its simplest form' && q.answer === '2/3')).toBe(true);
    expect(draw(2, 600).some(q => /3\/4 and 5\/6|5\/6 and 3\/4/.test(q.prompt) && q.answer === '12')).toBe(true);
  });

  it('d1: the answer is equal in value to the start and in lowest terms; exactly one option is both', () => {
    for (const q of draw(1)) {
      const start = fracs(q.prompt)[0];
      expect(same(start, q.answer) && lowest(q.answer), q.prompt).toBe(true);
      expect(q.options.filter(o => same(start, o) && lowest(o))).toEqual([q.answer]);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) expect(parseFrac(o), o).not.toBeNull();
    }
  });

  it('d2: the numerator or the lowest common denominator is right and no decoy is worth the answer', () => {
    let missing = 0, denom = 0;
    for (const q of draw(2)) {
      const eq = /^(\d+)\/(\d+) = \?\/(\d+)$/.exec(q.prompt);
      if (eq) { missing++; const [a, b, D] = eq.slice(1).map(Number); expect(Number(q.answer) * b).toBe(a * D); }
      else { denom++; const [x, y] = fracs(q.prompt).map(s => f(s).d); expect(Number(q.answer)).toBe(lcm(x, y)); expect(x).not.toBe(y); }
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options.filter(o => o !== q.answer)) expect(Number(o)).not.toBe(Number(q.answer));
    }
    expect(missing).toBeGreaterThan(50); expect(denom).toBeGreaterThan(50);
  });

  it('d2 denominator cards offer the product as a decoy', () => {
    for (const q of draw(2).filter(q => q.prompt.startsWith('Smallest'))) {
      const [x, y] = fracs(q.prompt).map(s => f(s).d);
      expect(q.options).toContain(String(x * y));
    }
  });

  it('d3: four distinct values, one above 1, the right extreme, and a decoy with the biggest top or bottom', () => {
    for (const q of draw(3)) {
      expect(q.optionsAreContent).toBe(true);
      expect(q.options).toHaveLength(4);
      const vs = q.options.map(f);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) expect(vs[i].n * vs[j].d, q.options.join()).not.toBe(vs[j].n * vs[i].d);
      expect(vs.some(v => v.n > v.d)).toBe(true);
      const big = q.prompt.includes('greatest');
      for (const o of q.options) if (o !== q.answer) expect(big ? f(q.answer).n * f(o).d > f(o).n * f(q.answer).d : f(q.answer).n * f(o).d < f(o).n * f(q.answer).d, `${q.prompt} ${q.options}`).toBe(true);
      const maxD = Math.max(...vs.map(v => v.d)), maxN = Math.max(...vs.map(v => v.n));
      expect(q.options.some(o => o !== q.answer && (f(o).d === maxD || f(o).n === maxN))).toBe(true);
    }
  });

  it('say is safe on every card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(sayIsSafe(q.say ?? q.prompt), q.prompt).toBe(true);
  });

  it('#1058 leak limit at d2', () => {
    const s = leakShares(topic.gen, 2); expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3);
  });
});
