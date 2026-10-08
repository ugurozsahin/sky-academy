import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-longmult')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1187 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const sum = (prompt: string) => { const m = prompt.match(/^([\d,]+) × ([\d,]+) = \?$/)!; return { a: num(m[1]), b: num(m[2]) }; };
const isBuild = (q: { build?: unknown }) => !!q.build;

describe('y5-longmult (#1187)', () => {
  it('is a Year 5 maths topic that stays out of Ninja Duel at d1–d2', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year5', 'maths', 'calc', 3]);
  });

  it('oracle: every product is exact and at most 989,901; pick-one cards have 4 distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 2000)) {
      const { a, b } = sum(q.prompt);
      expect(num(q.answer)).toBe(a * b);
      expect(a * b).toBeLessThanOrEqual(989901);
      if (isBuild(q)) continue;
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(num(o)).toBeGreaterThanOrEqual(0); expect(num(o)).toBeLessThanOrEqual(999999); });
    }
  });

  it('a built answer has 4 digits and a pre-printed comma; every product of 5+ digits is pick-one', () => {
    let built = 0;
    for (const q of draw(3, 800)) if (isBuild(q)) {
      built++;
      expect(q.build!.template).toBe('_,___');
      const { a, b } = sum(q.prompt); expect(a).toBeLessThan(100); expect(b).toBeLessThan(100);
      expect(num(q.answer)).toBeGreaterThanOrEqual(1000); expect(num(q.answer)).toBeLessThanOrEqual(9999);
    }
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) if (num(q.answer) >= 10000) expect(isBuild(q)).toBe(false);
    expect(built).toBeGreaterThan(250);
  });

  it('the ladder: d1 3-digit × 1-digit, d2 4×1 or 2×2, d3 builds and 3–4 digit × 2-digit', () => {
    for (const q of draw(1, 300)) { const { a, b } = sum(q.prompt); expect(a).toBeGreaterThanOrEqual(100); expect(a).toBeLessThan(1000); expect(b).toBeLessThan(10); }
    const shapes = new Set(draw(2, 300).map(q => { const { a, b } = sum(q.prompt); return `${String(a).length}×${String(b).length}`; }));
    expect([...shapes].sort()).toEqual(['2×2', '4×1']);
    expect(draw(3, 300).some(q => !isBuild(q) && sum(q.prompt).a >= 100)).toBe(true);
  });

  it('every 2-digit-multiplier pick-one card offers the missing-zero decoy', () => {
    let n = 0;
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const { a, b } = sum(q.prompt);
      if (isBuild(q) || b < 10) continue;
      n++;
      expect(q.options).toContain(num(String(a * Math.floor(b / 10) + a * (b % 10))).toLocaleString('en-GB'));
    }
    expect(n).toBeGreaterThan(300);
  });

  it('leak limit: at most 30 % of cards have a unique last or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      if (counted > 0) { expect(units / counted).toBeLessThanOrEqual(0.3); expect(leading / counted).toBeLessThanOrEqual(0.3); }
    }
  });
});
