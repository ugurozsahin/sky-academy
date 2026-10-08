import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-mentalmd')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1189 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
const nums = (p: string) => (p.match(/[\d,]+/g) ?? []).map(num);

/** The value the prompt asks for, worked out from its own numbers; `null` for a shape this does not know. */
function solve(p: string): number | null {
  let m = p.match(/^([\d,]+) × ([\d,]+) = \?$/); if (m) return num(m[1]) * num(m[2]);
  m = p.match(/^([\d,]+) ÷ ([\d,]+) = \?$/); if (m) return num(m[1]) / num(m[2]);
  m = p.match(/^\? × ([\d,]+) = ([\d,]+)$/) ?? p.match(/^([\d,]+) × \? = ([\d,]+)$/); if (m) return num(m[2]) / num(m[1]);
  m = p.match(/What is ([\d,]+) × ([\d,]+)\?$/); if (m) return num(m[1]) * num(m[2]);
  m = p.match(/What is ([\d,]+) ÷ ([\d,]+)\?$/); if (m) return num(m[1]) / num(m[2]);
  return null;
}
const kinds = (c: { prompt: string }) => c.prompt.includes('What is') ? 'given' : c.prompt.includes('?') && c.prompt.startsWith('?') || c.prompt.includes('× ? =') ? 'missing' : 'sum';

describe('y5-mentalmd (#1189)', () => {
  it('is a Year 5 maths topic in the calculation strand', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year5', 'maths', 'calc']);
  });

  it('oracle: every answer is exact, whole, 20 to 1,000,000, offered once, with 4 bubbles', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      const v = solve(c.prompt);
      expect(v, c.prompt).not.toBeNull();
      expect(Number.isInteger(v)).toBe(true);
      expect(num(c.answer), c.prompt).toBe(v);
      expect(num(c.answer)).toBeGreaterThanOrEqual(20);
      expect(num(c.answer)).toBeLessThanOrEqual(1000000);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('every card offers a place-value-shift decoy: one zero too many, or too few above 100,000', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      const a = num(c.answer), opts = c.options.map(num);
      expect(opts.includes(a * 10) || opts.includes(a / 10), c.prompt).toBe(true);
    }
  });

  it('d1 and d2 are a table fact scaled up by powers of 10; d2 scales both numbers', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 1000)) {
      const strip = (n: number) => { while (n % 10 === 0) n /= 10; return n; };
      for (const n of nums(c.prompt)) expect(strip(n), c.prompt).toBeLessThanOrEqual(81);
      if (d === 2) { const [x, y] = nums(c.prompt); expect(x % 10 === 0 || y % 10 === 0).toBe(true); expect(x % 10 === 0 && y % 10 === 0 || c.prompt.includes('÷')).toBe(true); }
    }
  });

  it('d3 offers all three shapes, and every "given fact" is itself correct', () => {
    const seen = new Set<string>();
    for (const c of draw(3, 2000)) {
      seen.add(kinds(c));
      if (c.prompt.includes('What is')) {
        const [x, y, p] = nums(c.prompt);
        expect(x * y, c.prompt).toBe(p);
        expect(c.prompt.length).toBeLessThanOrEqual(60);
      }
    }
    expect([...seen].sort()).toEqual(['given', 'missing', 'sum']);
  });

  it('leak limit: at most 30 % of cards have a unique last or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      expect(counted).toBeGreaterThan(1500);
      expect(units / counted).toBeLessThanOrEqual(0.3); expect(leading / counted).toBeLessThanOrEqual(0.3);
    }
  });
});
