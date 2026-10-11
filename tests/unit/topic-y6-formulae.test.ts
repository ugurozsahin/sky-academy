import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { ks2Solve, sameValue } from './helpers/ks2-oracle';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-formulae')!;
const draw = (d: Difficulty, n = 300): Question[] => { const r = rng(1270 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** The formula text with the drawn values put in: an implied product "3n" becomes "3 × 5", "2(l + w)" becomes "2 × (8 + 5)". */
function substituted(q: Question): string {
  const [formula, ask] = q.prompt.split('. ');
  const [lhs, rhs] = formula.split(' = ');
  const vals: Record<string, string> = {};
  for (const m of ask.matchAll(/([a-z]) = (\d+)/g)) vals[m[1]] = m[2];
  const body = rhs.replace(/(\d)([a-z])/g, '$1 × $2').replace(/(\d)\(/g, '$1 × (').replace(/[a-z]/g, c => vals[c]);
  expect(lhs).toBe(/^What is (\w) when/.exec(ask)![1]);
  return `${body} = ?`;
}

describe('y6-formulae (#1270)', () => {
  it('is registered for Year 6 maths in the algebra strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'algebra' }); });

  it('every card has four distinct options with the answer and a safe, speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(60);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.say, q.say).not.toMatch(/\d[a-z]/i);
    }
  });

  it('oracle: substituting the values into the formula text and evaluating it gives the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const v = ks2Solve(substituted(q));
      expect(v, substituted(q)).not.toBeNull(); expect(sameValue(q.answer, v!), `${substituted(q)} → ${q.answer}`).toBe(true);
    }
  });

  it('d1 is one operation and d2 two, in algebraic notation', () => {
    for (const q of draw(1)) expect(q.prompt, q.prompt).toMatch(/^y = (\d+ × n|n [+−] \d+)\./);
    for (const q of draw(2)) expect(q.prompt, q.prompt).toMatch(/^y = \dn [+−] \d+\./);
  });

  it('d2 offers the "3n is 35" decoy on every card', () => {
    for (const q of draw(2)) {
      const m = /^y = (\d)n ([+−]) (\d+)\. What is y when n = (\d+)\?$/.exec(q.prompt)!;
      const joined = Number(m[1] + m[4]) + (m[2] === '+' ? 1 : -1) * Number(m[3]);
      expect(q.options, q.prompt).toContain(String(joined));
    }
  });

  it('d3 uses only the listed formulae, each with a hand-checked value, and a bracket card offers the brackets-ignored decoy', () => {
    const seen = new Set<string>();
    for (const q of draw(3)) {
      const formula = q.prompt.split('. ')[0]; seen.add(formula);
      expect(['P = 2(l + w)', 'A = l × w', 'd = 2 × r', 'a = 180 − (b + c)', 'V = l × w × h']).toContain(formula);
      const n = Object.fromEntries([...q.prompt.matchAll(/([a-z]) = (\d+)/g)].map(m => [m[1], Number(m[2])]));
      const direct: Record<string, number> = { 'P = 2(l + w)': 2 * (n.l + n.w), 'A = l × w': n.l * n.w, 'd = 2 × r': 2 * n.r, 'a = 180 − (b + c)': 180 - (n.b + n.c), 'V = l × w × h': n.l * n.w * n.h };
      expect(q.answer, q.prompt).toBe(String(direct[formula]));
      if (formula === 'P = 2(l + w)') expect(q.options).toContain(String(2 * n.l + n.w));
      if (formula === 'a = 180 − (b + c)') expect(q.options).toContain(String(180 - n.b + n.c));
    }
    expect(seen.size).toBe(5);
  });

  it('say separates the coefficient from the letter and reads brackets aloud', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (/\dn /.test(q.prompt)) expect(q.say).toMatch(/\d n /);
      if (q.prompt.includes('(')) expect(q.say).toContain('bracket');
    }
    expect(draw(3).find(q => q.prompt.startsWith('P = 2(l + w)'))!.say).toMatch(/^P equals 2 bracket l plus w close bracket\. What is P when l equals \d+ and w equals \d+/);
  });

  it('is marked slow at d3 and nowhere else', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(!!q.slow, `${d} ${q.prompt}`).toBe(d === 3);
  });

  it('#1058 leak limit: no digit of the answer is unshared more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
