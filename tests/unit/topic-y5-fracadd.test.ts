import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal, type Frac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-fracadd')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1197 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** `3/8` or `1 3/8` → an improper fraction. */
const fr = (s: string): Frac => { const m = s.match(/^(?:(\d+) )?(\d+)\/(\d+)$/)!; return { n: (m[1] ? +m[1] * +m[3] : 0) + +m[2], d: +m[3] }; };
const lab = ({ n, d }: Frac) => (n < d ? `${n}/${d}` : `${Math.floor(n / d)} ${n % d}/${d}`);
const sides = (q: Question) => { const m = q.prompt.match(/^(.+?) ([+−]) (.+?) = \?$/)!; return { a: fr(m[1]), op: m[2], b: fr(m[3]) }; };
const val = (q: Question): Frac => { const { a, op, b } = sides(q); return { n: a.n * b.d + (op === '+' ? 1 : -1) * b.n * a.d, d: a.d * b.d }; };

describe('y5-fracadd (#1197)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('the oracle holds, the answer is never negative or simplified, and exactly one option has its value', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const v = val(q), ans = fr(q.answer);
      expect(equal(ans, v), q.prompt).toBe(true);
      expect(ans.n).toBeGreaterThan(0);
      expect(ans.d).toBe(Math.max(sides(q).a.d, sides(q).b.d));
      expect(q.options.filter(o => equal(fr(o), v)), q.prompt).toEqual([q.answer]);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it('d1 shares a bottom and stays under 1; d2 uses related bottoms and stays under 1; d3 sums to 1–2 or takes from 1 and a bit', () => {
    for (const q of draw(1)) { const { a, b } = sides(q); expect(a.d).toBe(b.d); expect(fr(q.answer).n).toBeLessThan(a.d); }
    for (const q of draw(2)) { const { a, b } = sides(q), hi = Math.max(a.d, b.d), lo = Math.min(a.d, b.d); expect(hi % lo).toBe(0); expect(fr(q.answer).n).toBeLessThan(hi); }
    let sums = 0, takes = 0;
    for (const q of draw(3)) {
      const { a, op, b } = sides(q), ans = fr(q.answer);
      if (op === '+') { sums++; expect(ans.n).toBeGreaterThan(ans.d); expect(ans.n).toBeLessThan(2 * ans.d); expect(q.answer).toMatch(/^1 \d+\/\d+$/); }
      else { takes++; expect(a.n).toBeGreaterThan(a.d); expect(a.d).toBe(b.d); expect(ans.n).toBeLessThan(ans.d); }
    }
    expect(sums).toBeGreaterThan(500); expect(takes).toBeGreaterThan(300);
  });

  it('the tops-and-bottoms slip is a bubble on every d2–d3 addition, and on a d2 subtraction when it is defined', () => {
    let adds = 0;
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) {
      const { a, op, b } = sides(q);
      const tb = op === '+' ? { n: a.n + b.n, d: a.d + b.d } : { n: Math.abs(a.n - b.n), d: Math.abs(a.d - b.d) };
      if (op === '+') adds++;
      if (op === '−' && (a.d === b.d || tb.n < 1)) continue;
      if (tb.n % tb.d === 0 || equal(tb, fr(q.answer))) continue;   // a whole number, or worth the answer, is no slip
      expect(q.options, q.prompt).toContain(lab(tb));
    }
    expect(adds).toBeGreaterThan(1000);
  });

  it('say names every fraction in words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say ?? '').not.toMatch(/\d|\/|=|\?/); expect(q.say).toBeTruthy(); }
  });
});
