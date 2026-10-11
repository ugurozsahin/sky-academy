import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-ratio')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1268 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s);

interface Solved { ans: number; additive?: number; other?: number }
/** Recomputes the answer from the prompt alone. */
function solve(p: string): Solved {
  let m = p.match(/^For every (\d+) .*? there are (\d+) .*?\. (\d+) .*?: how many/);
  if (m) { const [q, r, known] = [num(m[1]), num(m[2]), num(m[3])]; expect(known % q).toBe(0); return { ans: known / q * r, additive: known + (r - q) }; }
  m = p.match(/^(\d+) \w+: (\w+) gets (\d+) for every (\d+) (\w+) gets\. How many for (\w+)\?$/);
  if (m) {
    const [total, a, b] = [num(m[1]), num(m[3]), num(m[4])];
    expect(total % (a + b)).toBe(0);
    const mine = m[6] === m[2] ? a : b;
    return { ans: total / (a + b) * mine, other: total / (a + b) * (a + b - mine) };
  }
  m = p.match(/^(\d+)\/(\d+) of a \w+ of (\d+) are \w+\. How many (are not|are)\?$/);
  if (m) {
    const [n, d, total] = [num(m[1]), num(m[2]), num(m[3])];
    expect(total % d).toBe(0);
    const part = total / d * n, rest = total - part;
    return m[4] === 'are' ? { ans: part, other: rest } : { ans: rest, other: part };
  }
  m = p.match(/^A (\d+) cm by (\d+) cm rectangle, scale factor (\d+)\./);
  if (m) return { ans: Math.max(num(m[1]), num(m[2])) * num(m[3]), additive: Math.max(num(m[1]), num(m[2])) + num(m[3]) };
  m = p.match(/^A (\d+) cm side becomes (\d+) cm\./);
  if (m) { expect(num(m[2]) % num(m[1])).toBe(0); return { ans: num(m[2]) / num(m[1]), additive: num(m[2]) - num(m[1]) }; }
  throw new Error(`unrecognised prompt: ${p}`);
}

describe('y6-ratio (#1268)', () => {
  it('is a Year 6 ratio topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'ratio']);
  });

  it('hand-checked cards through the oracle', () => {
    expect(solve('For every 2 red beads there are 3 blue beads. 12 red: how many blue?').ans).toBe(18);
    expect(solve('35 stickers: Ali gets 2 for every 3 Bea gets. How many for Bea?').ans).toBe(21);
    expect(solve('3/5 of a class of 30 are boys. How many are not?').ans).toBe(12);
    expect(solve('A 4 cm by 6 cm rectangle, scale factor 3. New longer side, in cm?').ans).toBe(18);
    expect(solve('A 5 cm side becomes 20 cm. What is the scale factor?').ans).toBe(4);
  });

  it('oracle: the answer is recomputed, whole and positive, with four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const s = solve(c.prompt);
      expect(String(s.ans), c.prompt).toBe(c.answer);
      expect(Number.isInteger(s.ans) && s.ans > 0 && s.ans <= 120, c.prompt).toBe(true);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) expect(/^[1-9]\d*$/.test(o), o).toBe(true);
    }
  });

  it('the additive slip is an option on every d1 and d3 card, the other share on every d2 card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const s = solve(c.prompt), want = d === 2 ? s.other : s.additive;
      if (want !== undefined && want !== s.ans && want >= 1) expect(c.options, c.prompt).toContain(String(want));
    }
  });

  it('d1 uses parts 1–9 and an answer up to 100; d3 keeps lengths to 60 cm', () => {
    for (const c of draw(1)) {
      const [, q, p] = c.prompt.match(/^For every (\d+) .*? there are (\d+)/)!.map(Number) as number[];
      for (const v of [q, p]) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(9); }
      expect(q).not.toBe(p); expect(num(c.answer)).toBeLessThanOrEqual(100);
    }
    for (const c of draw(3)) for (const n of c.prompt.match(/\d+(?= cm)/g)!.concat(c.answer.length ? [c.answer] : [])) expect(num(n)).toBeLessThanOrEqual(60);
  });

  it('slow on every d3 card and on no d1 or d2 card', () => {
    for (const c of draw(3)) expect(c.slow, c.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) expect(c.slow, c.prompt).toBeFalsy();
  });

  it('every prompt passes the card budget, has a safe spoken form and no raw fraction in say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(cardBudgetProblem(c as Question), c.prompt).toBeNull();
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say).not.toMatch(/\d+\/\d+/);
      expect(sayIsSafe(c.say!), c.say).toBe(true);
    }
  });

  it('decoy digits: the last and leading digit leak on at most 30 % of in-scope cards', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
