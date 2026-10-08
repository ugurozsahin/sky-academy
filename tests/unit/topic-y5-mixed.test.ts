import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { equal, parseFrac, type Frac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-mixed')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1196 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const val = (s: string) => parseFrac(s) as Frac;

/** The value the prompt asks for, worked out from its own numbers. */
function solve(p: string): Frac {
  const sum = p.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+) = \?/);
  if (sum) return { n: Number(sum[1]) + Number(sum[3]), d: Number(sum[2]) };
  return val(p.replace(/ = \?.*$/, ''));
}

describe('y5-mixed (#1196)', () => {
  it('is a Year 5 maths topic in the fractions strand', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year5', 'maths', 'fractions']);
  });

  it('oracle: every answer has the prompt\'s value, with 4 distinct bubbles including the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      expect(equal(val(c.answer), solve(c.prompt)), c.prompt).toBe(true);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
    }
  });

  it('exactly one option has the answer\'s value (#296)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000))
      expect(c.options.filter(o => equal(val(o), val(c.answer))), c.prompt).toHaveLength(1);
  });

  it('answer forms: d1 and d3 are mixed numbers in the card\'s denominator, d2 is improper', () => {
    for (const c of draw(1, 500)) expect(c.answer, c.prompt).toMatch(/^\d+ \d+\/\d+$/);
    for (const c of draw(2, 500)) { expect(c.answer).toMatch(/^\d+\/\d+$/); expect(val(c.answer).n).toBeGreaterThan(val(c.answer).d); }
    for (const c of draw(3, 2000).filter(c => c.prompt.includes('+'))) {
      expect(c.answer).toMatch(/^\d+ \d+\/\d+$/);
      expect(c.answer.split('/')[1]).toBe(c.prompt.split('/')[1].split(' ')[0]);
      expect(c.prompt).toContain('Write it as a mixed number.');
    }
  });

  it('d3 offers the sum shape as well as both conversions', () => {
    const cards = draw(3, 300);
    expect(cards.some(c => c.prompt.includes('+'))).toBe(true);
    expect(cards.some(c => /^\d+\/\d+ = \?$/.test(c.prompt))).toBe(true);
    expect(cards.some(c => /^\d+ \d+\/\d+ = \?$/.test(c.prompt))).toBe(true);
  });

  it('every mixed answer and decoy is well formed (whole ≥ 1, 1 ≤ top < bottom) and d1 keeps the card\'s denominator', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 1000)) for (const o of c.options) {
      const m = /^(\d+) (\d+)\/(\d+)$/.exec(o);
      if (m) { expect(Number(m[1]), o).toBeGreaterThanOrEqual(1); expect(Number(m[2]), o).toBeGreaterThanOrEqual(1); expect(Number(m[2]), o).toBeLessThan(Number(m[3])); }
    }
    for (const c of draw(1, 500)) expect(c.answer.split('/')[1], c.prompt).toBe(c.prompt.split('/')[1].split(' ')[0]);
  });

  it('labels stay short enough for a bubble (at most 7 characters)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 1000)) for (const o of c.options) expect(o.length, o).toBeLessThanOrEqual(7);
  });

  it('no spoken form contains a raw fraction', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 500)) { expect(c.say, c.prompt).toBeTruthy(); expect(c.say, c.prompt).not.toMatch(/\d\/\d/); }
  });
});
