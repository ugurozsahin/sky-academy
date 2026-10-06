import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { BANK } from '../../src/curriculum/year4-story';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-story')!;
const draw = (d: Difficulty, n: number, seed = 1137) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
/** The template a prompt came from: its start sentence is its fixed prefix. */
const templateOf = (prompt: string) => BANK.find(t => prompt.startsWith(t[2].split('#')[0]) && prompt.includes(t[2].split('#')[1]))!;

describe('y4-story (#1137)', () => {
  it('is registered for Year 4, and the bank has ≥10 templates, ≥2 per operation pair', () => {
    expect(topic.year).toBe('year4');
    expect(BANK.length).toBeGreaterThanOrEqual(10);
    for (const pair of ['++', '+-', '-+', '--']) expect(BANK.filter(t => t[1].join('') === pair).length, pair).toBeGreaterThanOrEqual(2);
  });

  it('the oracle: the template\'s two operations applied in order give the answer, intermediate and answer in 1–9,999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      const t = templateOf(q.prompt), [a, b, c] = nums(q.prompt);
      const mid = t[1][0] === '+' ? a + b : a - b, ans = t[1][1] === '+' ? mid + c : mid - c;
      expect(num(q.answer), q.prompt).toBe(ans);
      expect(mid).toBeGreaterThanOrEqual(1); expect(mid).toBeLessThanOrEqual(9999);
      expect(ans).toBeGreaterThanOrEqual(1); expect(ans).toBeLessThanOrEqual(9999);
      expect(q.options).toContain(q.answer);
    }
  });

  it('the ladder: d1 stays under 1,000; d2 starts at four digits with three-digit changes; d3 has four-digit changes and units', () => {
    for (const q of draw(1, 300)) for (const n of nums(q.prompt)) expect(n, q.prompt).toBeLessThanOrEqual(999);
    for (const q of draw(2, 300)) { const [a, b, c] = nums(q.prompt); expect(a, q.prompt).toBeGreaterThanOrEqual(1000); expect(b).toBeLessThanOrEqual(999); expect(c).toBeLessThanOrEqual(999); }
    const d3 = draw(3, 400);
    for (const q of d3) { const [a, b, c] = nums(q.prompt); expect(a).toBeGreaterThanOrEqual(2000); expect(b).toBeGreaterThanOrEqual(1000); expect(c).toBeGreaterThanOrEqual(1000); }
    expect(d3.some(q => /\d (ml|g|m)\b/.test(q.prompt))).toBe(true);
    for (const q of draw(2, 200)) expect(q.prompt).not.toMatch(/\d (ml|g|m)\b/);
  });

  it('every operation pair is drawn at each difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) expect(new Set(draw(d, 800).map(q => templateOf(q.prompt)[1].join(''))), `d${d}`).toEqual(new Set(['++', '+-', '-+', '--']));
  });

  it('the one-step decoy (the intermediate result) is on every card; options are distinct, 1–9,999 and carry the unit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      const t = templateOf(q.prompt), [a, b] = nums(q.prompt);
      const mid = t[1][0] === '+' ? a + b : a - b;
      expect(q.options.map(num), q.prompt).toContain(mid);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(num(o)).toBeGreaterThanOrEqual(1); expect(num(o)).toBeLessThanOrEqual(9999); expect(o.replace(/[\d,]/g, '').trim()).toBe(q.answer.replace(/[\d,]/g, '').trim()); }
    }
  });

  it('every card has its own safe `say`, with the units spelt out and every prompt fits the card (#1051)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.say, q.prompt).toBeTruthy();
      expect(q.say, q.prompt).not.toMatch(/\d (ml|g|m)\b/);
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(cardBudgetProblem(q), q.prompt).toBeNull();
    }
  });

  it('distractors: ≤ 30 % unique units digit or leading digit at every difficulty (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
