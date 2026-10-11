import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-decmult')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1266 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Scaled integer: "3.45" → [345, 2]. Reads the decimal only through its digits, never a float. */
const sc = (s: string): [number, number] => { const [w, f = ''] = s.split('.'); return [Number(w + f), f.length]; };
/** The oracle: (a·10^dp × k) compared with the answer at the same scale. */
function solve(prompt: string): { a: [number, number]; k: number } {
  const m = prompt.match(/(\d+(?:\.\d+)?) × (\d+) = \?/);
  if (m) return { a: sc(m[1]), k: Number(m[2]) };
  const s = prompt.match(/(\d+(?:\.\d+)?) (?:m|kg|litres)\b.*?(\d+) (?:ribbons|bags|bottles|ropes|planks|boxes)/)!;
  return { a: sc(s[1]), k: Number(s[2]) };
}
const same = (x: [number, number], y: [number, number]) => { const dp = Math.max(x[1], y[1]); return x[0] * 10 ** (dp - x[1]) === y[0] * 10 ** (dp - y[1]); };

describe('y6-decmult (#1266)', () => {
  it('is a Year 6 fractions topic, built from difficulty 3', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year6', 'maths', 'fractions', 3]);
  });

  it('fixed table: 0.4 × 2 = 0.8, 0.7 × 6 = 4.2, 3.45 × 6 = 20.7', () => {
    const table: [number, number, number, number, string][] = [[4, 1, 2, 0, '0.8'], [7, 1, 6, 0, '4.2'], [345, 2, 6, 0, '20.7']];
    for (const [v, dp, k, , want] of table) expect(same([v * k, dp], sc(want))).toBe(true);
  });

  it('oracle: the answer is a × k, and no label shows a float artefact or a trailing zero', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const { a, k } = solve(c.prompt);
      expect(same([a[0] * k, a[1]], sc(c.answer)), c.prompt).toBe(true);
      for (const o of [c.answer, ...c.options]) {
        expect(o, c.prompt).not.toMatch(/\.\d*0$|\d{6,}|^\./);
      }
      expect(sayIsSafe(c.say ?? c.prompt), c.prompt).toBe(true);
    }
  });

  it('operand ranges: d1 one dp × 2–9, d2 two dp × 2–9, d3 one or two dp × 11–25', () => {
    for (const c of draw(1)) { const { a, k } = solve(c.prompt); expect(a[1]).toBe(1); expect(k).toBeGreaterThanOrEqual(2); expect(k).toBeLessThanOrEqual(9); }
    for (const c of draw(2)) { const { a, k } = solve(c.prompt); expect(a[1]).toBe(2); expect(a[0]).toBeGreaterThanOrEqual(101); expect(k).toBeLessThanOrEqual(9); }
    for (const c of draw(3)) { const { a, k } = solve(c.prompt); expect([1, 2]).toContain(a[1]); expect(a[0] / 10 ** a[1]).toBeLessThan(10); expect(k).toBeGreaterThanOrEqual(11); expect(k).toBeLessThanOrEqual(25); }
  });

  it('d1–d2 are pick-one: four distinct options, no decoy equal in value to the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) {
      expect(c.sequence).toBeUndefined();
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) if (o !== c.answer) expect(same(sc(o), sc(c.answer)), c.prompt).toBe(false);
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
