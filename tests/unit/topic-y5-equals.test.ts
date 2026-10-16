import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-equals')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1192 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));

/** Value of a pan; with `x` for the gap. */
function pan(s: string, x: number): number {
  const t = s.replace('?', String(x)).replace(/,/g, '');
  const m = t.match(/^(\d+)(?: ([+−×÷]) (\d+))?$/)!;
  const a = Number(m[1]), c = Number(m[3]);
  switch (m[2]) { case '+': return a + c; case '−': return a - c; case '×': return a * c; case '÷': return a / c; default: return a; }
}
const sides = (c: { visual?: unknown }) => c.visual as { type: string; left: string; right: string };

describe('y5-equals (#1192)', () => {
  it('is a Year 5 maths topic in the calculation strand', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year5', 'maths', 'calc']);
  });

  it('oracle: both pans are equal with the answer in the gap, which is a whole number 0–999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      const { left, right } = sides(c);
      expect(sides(c).type).toBe('scales');
      expect(left + right).toContain('?');
      const a = num(c.answer);
      expect(pan(left, a), c.prompt).toBe(pan(right, a));
      expect(Number.isInteger(a)).toBe(true);
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(999);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) { expect(num(o)).toBeGreaterThanOrEqual(0); expect(num(o)).toBeLessThanOrEqual(999); }
    }
  });

  it('every card offers the finished pan\'s total (the "answer comes next" slip)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      const { left, right } = sides(c);
      const total = pan(left.includes('?') ? right : left, 0);
      if (total === num(c.answer)) continue;
      expect(c.options.map(num), c.prompt).toContain(total);
    }
  });

  it('every pan is at most 11 characters', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      expect(sides(c).left.length).toBeLessThanOrEqual(11);
      expect(sides(c).right.length).toBeLessThanOrEqual(11);
    }
  });

  it('d1 uses + and −, d2 uses × and ÷, d3 puts a different operation on each pan', () => {
    for (const c of draw(1, 500)) expect(c.prompt).toMatch(/[+−]/);
    for (const c of draw(1, 500)) expect(c.prompt).not.toMatch(/[×÷]/);
    for (const c of draw(2, 500)) expect(c.prompt).not.toMatch(/[+−]/);
    for (const c of draw(3, 500)) {
      const ops = (s: string) => s.match(/[+−×÷]/)![0];
      expect(ops(sides(c).left)).not.toBe(ops(sides(c).right));
    }
  });

  it('leak limit: ≤30% of in-scope answers have a unique last or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units).toBeLessThanOrEqual(0.3); expect(s.leading).toBeLessThanOrEqual(0.3);
    }
  });
});
