import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-percentof')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1269 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));
/** p % of an amount, in integers. */
const pc = (p: number, amount: number) => { expect(p * amount % 100).toBe(0); return p * amount / 100; };

interface Solved { ans: number; steps: number[]; discount?: number }
/** Recomputes the answer from the prompt alone; `steps` are the decoys a card must offer. */
function solve(prompt: string): Solved {
  const p = prompt.replace(/(\d),(?=\d{3})/g, '$1');
  let m = p.match(/^(\d+)% of (\d+) = \?$/);
  if (m) { const [pp, a] = [num(m[1]), num(m[2])]; return { ans: pc(pp, a), steps: [a / 10, a / 20] }; }
  m = p.match(/^A coat costs £(\d+)\. It has (\d+)% off\./);
  if (m) { const off = pc(num(m[2]), num(m[1])); return { ans: num(m[1]) - off, steps: [], discount: off }; }
  m = p.match(/^What is (\d+)% of (\d+) (kg|litres|m), in (grams|ml|cm)\?$/);
  if (m) return { ans: pc(num(m[1]), num(m[2]) * (m[3] === 'm' ? 100 : 1000)), steps: [] };
  m = p.match(/^A: (\d+)% of (\d+)\. B: (\d+)% of (\d+)\. How many more/);
  if (m) return { ans: Math.abs(pc(num(m[1]), num(m[2])) - pc(num(m[3]), num(m[4]))), steps: [] };
  m = p.match(/^(\d+) [a-z]+: (\d+)% .*\. How many/);
  if (m) return { ans: num(m[1]) - pc(num(m[2]), num(m[1])), steps: [] };
  throw new Error(`unrecognised prompt: ${p}`);
}

describe('y6-percentof (#1269)', () => {
  it('is a Year 6 ratio topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'ratio']);
  });

  it('hand-checked cards through the oracle', () => {
    expect(solve('15% of 360 = ?').ans).toBe(54);
    expect(solve('25% of 80 = ?').ans).toBe(20);
    expect(solve('A coat costs £60. It has 20% off. What is the new price in pounds?').ans).toBe(48);
    expect(solve('What is 15% of 2 kg, in grams?').ans).toBe(300);
    expect(solve('A: 30% of 250. B: 40% of 180. How many more in the bigger?').ans).toBe(3);
    expect(solve('120 sweets: 25% are red. How many are not red?').ans).toBe(90);
  });

  it('oracle: the answer is recomputed, whole and positive, with four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      const s = solve(c.prompt);
      expect(s.ans.toLocaleString('en-GB'), c.prompt).toBe(c.answer);
      expect(Number.isInteger(s.ans) && s.ans > 0 && s.ans <= 10000, c.prompt).toBe(true);
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options) expect(/^[1-9]\d{0,2}(,\d{3})*$/.test(o), o).toBe(true);
    }
  });

  it('amounts stay within range: d1 up to 400, d2 up to 2,000', () => {
    const amount = (c: Question) => num(c.prompt.match(/of ([\d,]+)/)![1]);
    expect(amount({ prompt: '15% of 1,200 = ?' } as Question)).toBe(1200);
    for (const c of draw(1)) expect(amount(c)).toBeLessThanOrEqual(400);
    for (const c of draw(2)) expect(amount(c)).toBeLessThanOrEqual(2000);
    expect(Math.max(...draw(2, 600).map(amount))).toBeGreaterThan(1000);
  });

  it('d1 draws only 50, 25, 10, 20 and 75 %; d2 only 5, 15, 30, 35, 45 and 60 %', () => {
    const pcts = (d: Difficulty) => new Set(draw(d, 600).map(c => num(c.prompt.match(/^(\d+)%/)![1])));
    expect([...pcts(1)].sort((a, b) => a - b)).toEqual([10, 20, 25, 50, 75]);
    expect([...pcts(2)].sort((a, b) => a - b)).toEqual([5, 15, 30, 35, 45, 60]);
  });

  it('every d2 card offers the 10 % step alone (the 5 % step only when a leak decoy leaves room); every discount card offers the discount', () => {
    for (const c of draw(2)) {
      const s = solve(c.prompt);
      expect(c.options, c.prompt).toContain(s.steps[0].toLocaleString('en-GB'));
    }
    let discounts = 0;
    for (const c of draw(3, 600)) {
      const s = solve(c.prompt);
      if (s.discount !== undefined) { discounts++; expect(c.options, c.prompt).toContain(s.discount.toLocaleString('en-GB')); }
    }
    expect(discounts).toBeGreaterThan(0);
  });

  it('slow on every d3 card and on no d1 or d2 card', () => {
    for (const c of draw(3)) expect(c.slow, c.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d)) expect(c.slow, c.prompt).toBeFalsy();
  });

  it('every prompt passes the card budget and has a safe spoken form', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(cardBudgetProblem(c as Question), c.prompt).toBeNull();
      expect(c.say, c.prompt).toBeTruthy();
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
