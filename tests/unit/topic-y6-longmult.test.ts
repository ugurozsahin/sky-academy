import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-longmult')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1254 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const sum = (prompt: string) => { const m = prompt.match(/^([\d,]+) × ([\d,]+) = \?$/)!; return { a: num(m[1]), b: num(m[2]) }; };

describe('y6-longmult (#1254)', () => {
  it('is a Year 6 maths topic in the calc strand that stays out of Ninja Duel at d1–d2', () => {
    expect(topic).toBeDefined();
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year6', 'maths', 'calc', 3]);
  });

  it('is the first row of Y6_CALC', () => {
    expect(TOPICS.filter(t => t.year === 'year6' && t.strand === 'calc')[0].id).toBe('y6-longmult');
  });

  it('operand ranges per difficulty', () => {
    for (const q of draw(1, 300)) { const { a, b } = sum(q.prompt); expect(a).toBeGreaterThanOrEqual(12); expect(a).toBeLessThan(100); expect(b).toBeGreaterThanOrEqual(12); expect(b).toBeLessThan(100); }
    for (const q of draw(2, 300)) { const { a, b } = sum(q.prompt); expect(a).toBeGreaterThanOrEqual(100); expect(a).toBeLessThan(1000); expect(b).toBeGreaterThanOrEqual(12); expect(b).toBeLessThan(100); }
    for (const q of draw(3, 300)) { const { a, b } = sum(q.prompt); expect(a).toBeGreaterThanOrEqual(1000); expect(a).toBeLessThan(10000); expect(b).toBeGreaterThanOrEqual(11); expect(b).toBeLessThan(100); }
  });

  it('oracle: the answer is a × b; d1–d2 have four distinct options, no sequence', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      const { a, b } = sum(q.prompt);
      expect(num(q.answer)).toBe(a * b);
      if (d === 3) continue;
      expect(q.sequence).toBeUndefined();
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
    }
  });

  it('d3 is built: five or six slots, the comma fixed, the digits joined equal the product, the sum on the card', () => {
    for (const q of draw(3, 300)) {
      expect(q.build).toBeDefined();
      const slots = (q.build!.template.match(/_/g) ?? []).length;
      expect(slots).toBeGreaterThanOrEqual(5); expect(slots).toBeLessThanOrEqual(6);
      expect(q.build!.template).toMatch(/^_{2,3},___$/);
      expect(q.sequence!.join('')).toBe(String(num(q.answer)));
      expect(q.prompt).toMatch(/ = \?$/);
    }
  });

  it('slow on every d3 card and on no d1 or d2 card', () => {
    for (const q of draw(3, 300)) expect(q.slow).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 300)) expect(q.slow).toBeFalsy();
  });

  it('every d1–d2 card offers the missing-placeholder-zero decoy', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 400)) {
      const { a, b } = sum(q.prompt);
      const slip = a * Math.floor(b / 10) + a * (b % 10);
      if (slip !== a * b) expect(q.options.map(num)).toContain(slip);
    }
  });

  it('leak limit: at most 30 % of cards have a unique last or leading digit', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      expect(counted).toBeGreaterThan(0);
      expect(units / counted).toBeLessThanOrEqual(0.3); expect(leading / counted).toBeLessThanOrEqual(0.3);
    }
  });
});
