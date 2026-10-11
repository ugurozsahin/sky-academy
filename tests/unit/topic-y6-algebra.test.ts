import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { ks2Solve, sameValue } from './helpers/ks2-oracle';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-algebra')!;
const draw = (d: Difficulty, n = 300): Question[] => { const r = rng(1272 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^\d]/g, ''));

/** The d1/d2 equation with the answer put in for the letter: "3n + 5 = 26" with 7 becomes "3 × 7 + 5 = ?". */
function substituted(q: Question): string {
  const eq = q.prompt.split('. ')[0], [lhs] = eq.split(' = ');
  return `${lhs.replace(/(\d)n/g, `$1 × ${q.answer}`).replace(/n/g, q.answer)} = ?`;
}

describe('y6-algebra (#1272)', () => {
  it('is registered for Year 6 maths in the algebra strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'algebra' }); });

  it('every card has four distinct options with the answer and a safe, speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.say, q.say).not.toMatch(/\d[a-z]/i);
    }
  });

  it('oracle: ks2Solve solves every d1/d2 equation to the answer, and the answer put back makes both sides equal', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const eq = q.prompt.split('. ')[0], v = ks2Solve(eq);
      expect(v, eq).not.toBeNull(); expect(sameValue(q.answer, v!), `${eq} → ${q.answer}`).toBe(true);
      const rhs = Number(eq.split(' = ')[1]), left = ks2Solve(substituted(q));
      expect(left, substituted(q)).not.toBeNull(); expect(sameValue(String(rhs), left!), `${substituted(q)} vs ${rhs}`).toBe(true);
      expect(Number.isInteger(Number(q.answer)) && Number(q.answer) <= 200, q.prompt).toBe(true);
    }
  });

  it('d1 is one step and d2 two steps', () => {
    for (const q of draw(1)) expect(q.prompt, q.prompt).toMatch(/^(n [+−] \d+ = \d+|\d+ × n = \d+|n ÷ \d+ = \d+)\. What is n\?$/);
    for (const q of draw(2)) expect(q.prompt, q.prompt).toMatch(/^\dn [+−] \d+ = \d+\. What is n\?$/);
  });

  it('d2 offers the "one step only" decoy on every card, and d1 the inverse-not-applied one', () => {
    for (const q of draw(2)) {
      const m = /^(\d)n ([+−]) (\d+) = (\d+)\./.exec(q.prompt)!;
      expect(q.options, q.prompt).toContain(String(m[2] === '+' ? Number(m[4]) - Number(m[3]) : Number(m[4]) + Number(m[3])));
    }
    for (const q of draw(1)) {
      const m = /^n ([+−]) (\d+) = (\d+)\./.exec(q.prompt);
      if (m) expect(q.options, q.prompt).toContain(String(m[1] === '+' ? Number(m[3]) + Number(m[2]) : Number(m[3]) - Number(m[2])));
    }
  });

  it('d3 is a length or angle from the fixed set with a hand-checked answer, and is slow with a say', () => {
    const seen = new Set<string>();
    for (const q of draw(3)) {
      const nums = [...q.prompt.matchAll(/\d+/g)].map(m => Number(m[0]));
      if (q.prompt.startsWith('The angles in a triangle')) { seen.add('tri'); expect(q.answer).toBe(`${180 - nums[0] - nums[1]}°`); expect(q.options).toContain(`${360 - nums[0] - nums[1]}°`); }
      else if (q.prompt.startsWith('Angles on a straight line')) { seen.add('line'); expect(q.answer).toBe(`${180 - nums[0]}°`); }
      else if (q.prompt.startsWith('Rectangle: ')) { seen.add('rect'); expect(q.answer).toBe(`${nums[0] / 2 - nums[1]} cm`); expect(q.options).toContain(`${nums[0] - nums[1]} cm`); }
      else throw new Error(`unknown d3 card: ${q.prompt}`);
      expect(q.slow, q.prompt).toBe(true); expect(q.say, q.prompt).toBeTruthy();
      expect(num(q.answer), q.prompt).toBeGreaterThan(0);
    }
    expect(seen.size).toBe(3);
  });

  it('say separates the coefficient from the letter', () => {
    for (const q of draw(2)) expect(q.say).toMatch(/^\d n (plus|minus) \d+ equals \d+\. What is n\?$/);
  });

  it('is marked slow at d3 and nowhere else', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(!!q.slow, `${d} ${q.prompt}`).toBe(d === 3);
  });

  it('#1058 leak limit: no digit of the answer is unshared more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
