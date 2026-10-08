import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-column')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1182 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const calc = (prompt: string) => { const m = prompt.match(/([\d,]+) ([+−]) ([\d,]+)/)!; return { a: num(m[1]), add: m[2] === '+', b: num(m[3]) }; };
const exact = (prompt: string) => { const { a, b, add } = calc(prompt); return add ? a + b : a - b; };
const isBuild = (q: { build?: unknown }) => !!q.build;

describe('y5-column (#1182)', () => {
  it('is a Year 5 maths topic that stays out of Ninja Duel at d1–d2', () => {
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.sequenceFrom).toBe(3); expect(topic.strand).toBe('calc');
  });

  it('every pick-one answer is exact and in 0..999,999 on every difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 2000)) {
      if (isBuild(q)) continue;
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(num(o)).toBeGreaterThanOrEqual(0); expect(num(o)).toBeLessThanOrEqual(999999); });
      if (/^Round/.test(q.prompt)) {
        const p = num(q.prompt.match(/nearest ([\d,]+)/)![1]), { a, b, add } = calc(q.prompt);
        const r = (n: number) => Math.round(n / p) * p;
        expect(num(q.answer)).toBe(add ? r(a) + r(b) : r(a) - r(b));
      } else expect(num(q.answer)).toBe(exact(q.prompt));
    }
  });

  it('a built answer has at most 4 digits and a pre-printed comma; every answer of 5+ digits is pick-one', () => {
    let built = 0;
    for (const q of draw(3, 800)) {
      if (isBuild(q)) {
        built++;
        expect(q.build!.template).toBe('_,___');
        expect(num(q.answer)).toBe(exact(q.prompt));
        expect(num(q.answer)).toBeGreaterThanOrEqual(1000); expect(num(q.answer)).toBeLessThanOrEqual(9999);
        const { a, b } = calc(q.prompt); expect(a).toBeLessThanOrEqual(99999); expect(b).toBeGreaterThanOrEqual(10000);
      }
    }
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) if (num(q.answer) >= 10000) expect(isBuild(q)).toBe(false);
    expect(built).toBeGreaterThan(250);
  });

  it('the ladder: d1 four digits, d2 five and six digits, d3 builds and estimates', () => {
    for (const q of draw(1, 300)) { const { a, b } = calc(q.prompt); expect(a).toBeLessThan(10000); expect(b).toBeLessThan(10000); expect(num(q.answer)).toBeLessThan(10000); }
    let big = 0;
    for (const q of draw(2, 300)) { expect(num(q.answer)).toBeGreaterThanOrEqual(10000); if (calc(q.prompt).a >= 100000) big++; }
    expect(big).toBeGreaterThan(50);
    const kinds = new Set(draw(3, 200).map(q => isBuild(q) ? 'build' : 'round'));
    expect([...kinds].sort()).toEqual(['build', 'round']);
  });

  it('column-mistake decoys: smaller-from-larger on exchanging subtractions, a dropped carry on additions', () => {
    let subs = 0, adds = 0;
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 500)) {
      const { a, b, add } = calc(q.prompt), ans = exact(q.prompt);
      if (!add) {
        subs++;
        const x = String(a), y = String(b).padStart(x.length, '0');
        const sfl = [...x].map((c, i) => Math.abs(Number(c) - Number(y[i]))).join('');
        expect(q.options).toContain(f(Number(sfl)));
      } else if ([10, 100, 1000, 10000, 100000].some(m => a % m + b % m >= m)) {
        adds++;
        expect([10, 100, 1000, 10000, 100000].some(m => q.options.includes(f(ans - m)))).toBe(true);
      }
    }
    expect(subs).toBeGreaterThan(100); expect(adds).toBeGreaterThan(100);
  });

  it('estimate decoys include the ×10 slip', () => {
    let n = 0;
    for (const q of draw(3, 600)) if (!isBuild(q)) { n++; expect(q.options).toContain(f(num(q.answer) * 10)); }
    expect(n).toBeGreaterThan(200);
  });

  it('leak limit: at most 30% of pick-one cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(900);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});
const f = (n: number) => n.toLocaleString('en-GB');
