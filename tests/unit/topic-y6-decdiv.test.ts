import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-decdiv')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1267 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Scaled integer: "3.45" → [345, 2]. Reads the decimal only through its digits, never a float. */
const sc = (s: string): [number, number] => { const [w, f = ''] = s.replace(/,/g, '').split('.'); return [Number(w + f), f.length]; };
const solve = (prompt: string) => { const m = prompt.match(/([\d,]+(?:\.\d+)?) ÷ (\d+) = \?/)!; return { a: sc(m[1]), k: Number(m[2]) }; };
const same = (x: [number, number], y: [number, number]) => { const dp = Math.max(x[1], y[1]); return x[0] * 10 ** (dp - x[1]) === y[0] * 10 ** (dp - y[1]); };

describe('y6-decdiv (#1267)', () => {
  it('is a Year 6 fractions topic, built from difficulty 3', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year6', 'maths', 'fractions', 3]);
  });

  it('fixed table: 9 ÷ 4 = 2.25, 147 ÷ 4 = 36.75, 987 ÷ 25 = 39.48', () => {
    for (const [n, k, want] of [[9, 4, '2.25'], [147, 4, '36.75'], [987, 25, '39.48']] as const) expect(same([sc(want)[0] * k, 2], [n * 100, 2])).toBe(true);
  });

  it('oracle: answer × divisor = dividend at scale, answers have 1–2 dp and no float artefact or trailing zero', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const { a, k } = solve(c.prompt), ans = sc(c.answer);
      expect(ans[1], c.prompt).toBeGreaterThanOrEqual(1); expect(ans[1]).toBeLessThanOrEqual(2);
      expect(same([ans[0] * k, ans[1]], a), c.prompt).toBe(true);
      for (const o of [c.answer, ...c.options]) expect(o, c.prompt).not.toMatch(/\.\d*0$|\d{6,}|^\./);
      expect(sayIsSafe(c.say ?? c.prompt), c.prompt).toBe(true);
    }
  });

  it('operand ranges: d1 whole 3–99 ÷ 2, 4, 5; d2 3-digit or 1 dp ÷ 2–9; d3 3–4 digits ÷ 20, 25, 40, 50', () => {
    for (const c of draw(1)) { const { a, k } = solve(c.prompt); expect(a[1]).toBe(0); expect(a[0]).toBeLessThan(100); expect([2, 4, 5]).toContain(k); }
    for (const c of draw(2)) { const { a, k } = solve(c.prompt); expect([0, 1]).toContain(a[1]); expect(k).toBeGreaterThanOrEqual(2); expect(k).toBeLessThanOrEqual(9); if (a[1] === 0) expect(a[0]).toBeGreaterThanOrEqual(100); }
    for (const c of draw(3)) { const { a, k } = solve(c.prompt); expect(a[1]).toBe(0); expect(a[0]).toBeGreaterThanOrEqual(100); expect([20, 25, 40, 50]).toContain(k); }
  });

  it('d1–d2 are pick-one: four distinct options, no decoy equal in value to the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) {
      expect(c.sequence).toBeUndefined();
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) if (o !== c.answer) expect(same(sc(o), sc(c.answer)), c.prompt).toBe(false);
    }
  });

  it('the remainder-as-decimal decoy is on every pick-one card where it differs from the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) {
      const { a, k } = solve(c.prompt), dp = a[1];
      const slip = `${Math.floor(a[0] / k)}.${a[0] % k}`;
      const want = Number(slip) / 10 ** dp;
      if (Math.abs(want - Number(c.answer)) < 1e-9) continue;
      expect(c.options.some(o => Math.abs(Number(o) - want) < 1e-9), c.prompt).toBe(true);
    }
  });

  it('d3 is built: at most five digit slots, the point fixed, the sliced digits are the answer', () => {
    for (const c of draw(3)) {
      expect(c.build).toBeDefined();
      const tpl = c.build!.template;
      expect((tpl.match(/_/g) ?? []).length).toBeLessThanOrEqual(5);
      expect(tpl).toContain('.');
      expect(c.sequence!.join('')).toBe(c.answer.replace('.', ''));
      expect(c.options.length).toBeLessThanOrEqual(10);
    }
  });

  it('slow on every d3 card and on no d1 or d2 card', () => {
    for (const c of draw(3)) expect(c.slow).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) expect(c.slow).toBeFalsy();
  });

  it('leak limit: at most 30 % of pick-one cards have a unique last or leading digit', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      expect(counted).toBeGreaterThan(0);
      expect(units).toBeLessThanOrEqual(0.3); expect(leading).toBeLessThanOrEqual(0.3);
    }
  });
});
