import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { solve } from './helpers/ks2-oracle';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-multiply')!;
const draws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);

describe('y3-multiply (#1088)', () => {
  it('is registered once, in Year 3, and builds from d3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-multiply')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.sequenceFrom).toBe(3);
  });

  it('oracle: every d1–d2 answer equals the prompt\'s arithmetic', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1088_100)) {
      expect(solve(c.prompt), c.prompt).toBe(Number(c.answer));
      expect(c.options, c.prompt).toContain(c.answer);
      expect(new Set(c.options).size, c.prompt).toBe(4);
    }
  });

  it('d1: the shown fact is the prompt\'s fact with the tens removed', () => {
    for (const c of draws(1, 1088_200)) {
      expect(c.visual?.type).toBe('word');
      const fact = (c.visual as { text: string }).text, [fa, fb, fc] = nums(fact), [pa, pb] = nums(c.prompt);
      expect(solve(fact.replace(/= \d+$/, '= ?')), fact).toBe(fc);
      // × : 3 × 4 = 12 scales to 30 × 4; ÷ : 12 ÷ 4 = 3 scales to 120 ÷ 4 = 30 (the dividend's tens are the fact's)
      expect([fa * 10, fb], c.prompt).toEqual([pa, pb]);
      expect(Number(c.answer)).toBe(fc * 10);
      expect([2, 3, 4, 5, 8]).toContain(fb);
    }
  });

  it('d2 multiplies 11–49 by 2, 3, 4, 5 or 8, products ≤ 392', () => {
    for (const c of draws(2, 1088_300)) {
      const [a, m] = nums(c.prompt);
      expect(a).toBeGreaterThanOrEqual(11); expect(a).toBeLessThanOrEqual(49);
      expect([2, 3, 4, 5, 8]).toContain(m);
      expect(Number(c.answer)).toBeLessThanOrEqual(392);
    }
  });

  it('d3: build cards, constant bubble count, sequence joins to the answer, prompt on the card', () => {
    for (const c of draws(3, 1088_400)) {
      const [a, m] = nums(c.prompt);
      expect(c.sequence!.join(''), c.prompt).toBe(String(a * m));
      expect(c.build, c.prompt).toBeDefined();
      expect(c.options.length - new Set(c.sequence).size + c.sequence!.length, c.prompt).toBe(6); // launched bubbles (#481)
      expect(Number(c.answer)).toBeLessThanOrEqual(392);
    }
  });

  it('distractors: ≤ 30 % unique units digit or leading digit at d1–d2', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
