import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { compare, type Frac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-fraccompare')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1194 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const fr = (s: string): Frac => { const [n, d] = s.split('/').map(Number); return { n, d }; };   // raw, not simplified: 'related' and 'widest' are about the bottoms as printed
const distinctValues = (fs: Frac[]) => fs.every((f, i) => fs.every((g, j) => i === j || compare(f, g) !== 0));
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const related = (fs: Frac[]) => fs.reduce((g, f) => gcd(g, f.d), 0) > 1;

describe('y5-fraccompare (#1194)', () => {
  it('is a Year 5 maths topic in the fractions strand, with the ordering card from d3', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year5', 'maths', 'fractions', 3]);
  });

  it('oracle: one correct answer by value over 2,000 draws, all values distinct, denominators related', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 2000)) {
      const fs = c.options.map(fr);
      expect(distinctValues(fs)).toBe(true);
      const sorted = fs.slice().sort(compare), a = fr(c.answer);
      expect(compare(a, c.prompt.match(/larg|Which is larger/) ? sorted[sorted.length - 1] : sorted[0])).toBe(0);
      expect(c.options).toContain(c.answer);
      if (d === 2) expect(related(fs)).toBe(true);
    }
  });

  it('d1: two fractions on one bottom or one top', () => {
    for (const c of draw(1, 500)) {
      const [a, b] = c.options.map(fr);
      expect(c.options).toHaveLength(2);
      expect(a.d === b.d || a.n === b.n).toBe(true);
    }
  });

  it('d2: the unique biggest bottom is always on the card and is never the answer', () => {
    for (const c of draw(2, 2000)) {
      const fs = c.options.map(fr), top = Math.max(...fs.map(f => f.d)), widest = fs.filter(f => f.d === top);
      expect(c.options.length).toBeGreaterThanOrEqual(3);
      expect(widest).toHaveLength(1);
      expect(c.options).toContain(`${widest[0].n}/${widest[0].d}`);
      expect(fr(c.answer)).not.toEqual(widest[0]);
    }
  });

  it('d3: three fractions, strictly increasing in value, on related bottoms', () => {
    for (const c of draw(3, 2000)) {
      const seq = c.sequence!.map(fr);
      expect(seq).toHaveLength(3);
      for (let i = 1; i < 3; i++) expect(compare(seq[i - 1], seq[i])).toBe(-1);
      expect(related(seq)).toBe(true);
      expect(c.answer).toBe(c.sequence!.join(' '));
    }
  });

  it('no spoken line carries a raw fraction', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 500)) expect(c.say ?? '').not.toMatch(/\d\/\d/);
  });
});
