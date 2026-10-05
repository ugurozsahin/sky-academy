import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { compare, type Frac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-fraccompare')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1096 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const frac = (s: string): Frac => { const [n, d] = s.split('/').map(Number); return { n, d }; };
const SIGN = { '-1': '<', '0': '=', '1': '>' } as const;

describe('y3-fraccompare (#1096)', () => {
  it('is registered once, in Year 3, with the sequence flag at d3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-fraccompare')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.sequenceFrom).toBe(3);
  });

  it('d1–d2: the sign matches the values, all three signs are offered, and no sequence is drawn', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d)) {
      const m = c.prompt.match(/^(\d+\/\d+) \? (\d+\/\d+)$/)!;
      expect(m, c.prompt).not.toBeNull();
      expect(c.answer, c.prompt).toBe(SIGN[String(compare(frac(m[1]), frac(m[2]))) as '-1']);
      expect([...c.options!].sort(), c.prompt).toEqual(['<', '=', '>']);
      expect(c.sequence).toBeUndefined();
    }
  });

  it('d1 draws two different unit fractions on denominators 2–10, never equal', () => {
    for (const c of draws(1)) {
      const [a, b] = c.prompt.split(' ? ').map(frac);
      expect([a.n, b.n]).toEqual([1, 1]);
      expect(a.d).not.toBe(b.d);
      expect(Math.min(a.d, b.d)).toBeGreaterThanOrEqual(2);
      expect(Math.max(a.d, b.d)).toBeLessThanOrEqual(10);
    }
  });

  it('d2 draws equal pairs on 10–20 % of cards, and unit and same-denominator pairs too', () => {
    const cs = draws(2), eq = cs.filter(c => c.answer === '=').length / DRAWS;
    expect(eq).toBeGreaterThanOrEqual(0.1);
    expect(eq).toBeLessThanOrEqual(0.2);
    const pairs = cs.map(c => c.prompt.split(' ? ').map(frac));
    expect(pairs.some(([a, b]) => a.n === 1 && b.n === 1 && a.d !== b.d)).toBe(true);
    expect(pairs.some(([a, b]) => a.d === b.d && a.n !== b.n)).toBe(true);
  });

  it('d3: the answer is the three fractions ascending by value, with no two equal', () => {
    for (const c of draws(3) as Question[]) {
      const seq = c.sequence!;
      expect(seq, c.prompt).toHaveLength(3);
      expect(c.answer).toBe(seq.join(','));
      expect([...c.options!].sort()).toEqual([...seq].sort());
      for (let i = 0; i < 2; i++) expect(compare(frac(seq[i]), frac(seq[i + 1])), c.prompt).toBe(-1);
    }
  });

  it('d1–d2 never draw a sequence and d3 always does', () => {
    for (const d of [1, 2] as Difficulty[]) expect(draws(d).some(c => c.sequence)).toBe(false);
    expect(draws(3).every(c => c.sequence)).toBe(true);
  });

  it('every card is spoken with no raw fraction or sign (#1057)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say, c.prompt).not.toMatch(/\d|[<>=]/);
    }
  });
});
