import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-squares')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1191 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^\d]/g, ''));
const SQ = Array.from({ length: 40 }, (_, i) => (i + 1) ** 2), CB = [1, 8, 27, 64, 125, 1000];

/** The value the prompt asks for, worked out from its own numbers; `null` for a "which is" card or an unknown shape. */
function solve(p: string): number | null {
  let m = p.match(/^(\d+)² = \?$/); if (m) return Number(m[1]) ** 2;
  m = p.match(/^(\d+)³ = \?$/); if (m) return Number(m[1]) ** 3;
  m = p.match(/^(\d+)² \+ (\d+)² = \?$/); if (m) return Number(m[1]) ** 2 + Number(m[2]) ** 2;
  m = p.match(/^What number squared is (\d+)\?$/) ?? p.match(/area of (\d+) cm²/); if (m) return Math.sqrt(Number(m[1]));
  return null;
}
const isWhich = (p: string) => p.startsWith('Which');

describe('y5-squares (#1191)', () => {
  it('is a Year 5 maths topic in the calculation strand', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year5', 'maths', 'calc']);
  });

  it('oracle: every answer is exact, with 4 distinct bubbles including the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      if (!isWhich(c.prompt)) expect(num(c.answer), c.prompt).toBe(solve(c.prompt));
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('"which is" cards have exactly one member among the options', () => {
    let squares = 0, cubes = 0, both = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      if (!isWhich(c.prompt)) continue;
      const opts = c.options.map(num);
      if (c.prompt.includes('both')) { both++; expect(opts.filter(v => SQ.includes(v) && CB.includes(v))).toEqual([64]); expect(num(c.answer)).toBe(64); }
      else if (c.prompt.includes('square')) { squares++; expect(opts.filter(v => SQ.includes(v))).toEqual([num(c.answer)]); }
      else { cubes++; expect(opts.filter(v => CB.includes(v))).toEqual([num(c.answer)]); }
    }
    expect(squares).toBeGreaterThan(100); expect(cubes).toBeGreaterThan(100); expect(both).toBeGreaterThan(100);
  });

  it('every n² and n³ card offers the doubling or tripling decoy when it differs from the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 2000)) {
      const m = c.prompt.match(/^(\d+)([²³]) = \?$/); if (!m) continue;
      const n = Number(m[1]), mistake = n * (m[2] === '²' ? 2 : 3);
      if (mistake !== num(c.answer)) expect(c.options.map(num), c.prompt).toContain(mistake);
    }
  });

  it('d3 offers all four problem shapes; d1 and d2 stay in range', () => {
    const seen = new Set(draw(3, 1000).map(c => c.prompt.startsWith('Which') ? 'both' : c.prompt.includes('+') ? 'sum' : c.prompt.includes('area') ? 'side' : 'root'));
    expect([...seen].sort()).toEqual(['both', 'root', 'side', 'sum']);
    for (const c of draw(1, 500)) expect(num(c.answer)).toBeLessThanOrEqual(144);
    for (const c of draw(2, 500)) expect(num(c.answer)).toBeLessThanOrEqual(1000);
  });

  it('the card shows the notation, and no spoken form contains ² or ³', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 500)) {
      expect(c.say ?? '', c.prompt).not.toMatch(/[²³]/);
      if (/[²³]/.test(c.prompt)) expect(c.say).toMatch(/squared|cubed|square centimetres|squared,/);
    }
  });

  it('leak limit: at most 30 % of cards have an answer whose last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, counted } = leakShares(topic.gen, d);
      if (d > 1) expect(counted).toBeGreaterThan(300);
      expect(units).toBeLessThanOrEqual(0.3);
    }
  });
});
