import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { BANK, MAX } from '../../src/curriculum/year5-story';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-story')!;
const draw = (d: Difficulty, n: number, seed = 1184) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The template a prompt came from: its text with every `#` as a number is a regex. */
const templateOf = (prompt: string) => BANK.find(t => new RegExp('^' + t[1].split('#').map(esc).join('\\d[\\d,]*') + ' ' + esc(t[2]) + '$').test(prompt))!;
const CEILING: Record<number, number> = { 1: 10000, 2: 99999, 3: 999999 };

describe('y5-story (#1184)', () => {
  it('is registered for Year 5, and the bank has ≥12 templates with two and three steps', () => {
    expect(topic.year).toBe('year5');
    expect(BANK.length).toBeGreaterThanOrEqual(12);
    expect(BANK.filter(t => t[0].length === 2).length).toBeGreaterThanOrEqual(8);
    expect(BANK.filter(t => t[0].length === 3).length).toBeGreaterThanOrEqual(4);
    for (const t of BANK) expect(t[1].split('#').length - 1, t[2]).toBe(t[0].length + 1);
  });

  it('the oracle: the template\'s operations applied in order give the answer, every running result in range', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      const t = templateOf(q.prompt), v = nums(q.prompt);
      expect(v).toHaveLength(t[0].length + 1);
      let run = v[0];
      t[0].forEach((op, i) => { run = op === '+' ? run + v[i + 1] : run - v[i + 1]; expect(run, q.prompt).toBeGreaterThanOrEqual(1); expect(run).toBeLessThanOrEqual(CEILING[d]); });
      expect(num(q.answer), q.prompt).toBe(run);
      expect(q.options).toContain(q.answer);
    }
  });

  it('the ladder: d1 two steps to 10,000; d2 two steps with five-digit numbers; d3 three steps', () => {
    for (const q of draw(1, 300)) { expect(templateOf(q.prompt)[0]).toHaveLength(2); for (const n of nums(q.prompt)) expect(n, q.prompt).toBeLessThanOrEqual(10000); }
    for (const q of draw(2, 300)) { expect(templateOf(q.prompt)[0]).toHaveLength(2); expect(nums(q.prompt)[0], q.prompt).toBeGreaterThanOrEqual(10000); }
    const d3 = draw(3, 400);
    expect(d3.some(q => templateOf(q.prompt)[0].length === 3)).toBe(true);
    for (const q of d3) expect(q.slow, q.prompt).toBe(true);
  });

  it('no template is dead: each fits the card at its largest numbers, and several are dealt at every difficulty', () => {
    const widest: Record<number, number[]> = { 1: [5, 5], 2: [6, 6], 3: [7, 6] }; // [start, change] characters, commas included
    for (const [ops, text, ask] of BANK) {
      const d = ops.length === 3 ? 3 : 2;
      const [s0, c0] = widest[d], len = text.replace(/#/g, '').length + 1 + ask.length + s0 + ops.length * c0;
      expect(len, text).toBeLessThanOrEqual(MAX);
    }
    const kinds = (d: Difficulty) => new Set(draw(d, 400).map(q => templateOf(q.prompt)[1]));
    expect(kinds(1).size).toBeGreaterThanOrEqual(7);
    expect(kinds(2).size).toBeGreaterThanOrEqual(7);
    expect(kinds(3).size).toBeGreaterThanOrEqual(5);
  });

  it('only d3 is slow', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d, 100)) expect(q.slow, q.prompt).toBeFalsy();
  });

  it('every operation pair is drawn at d1 and d2', () => {
    for (const d of [1, 2] as Difficulty[]) expect(new Set(draw(d, 800).map(q => templateOf(q.prompt)[0].join(''))), `d${d}`).toEqual(new Set(['++', '+-', '-+', '--']));
  });

  it('the one-step decoy (the result one step early) is on every card; options are distinct, in range', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      const t = templateOf(q.prompt), v = nums(q.prompt);
      let early = v[0];
      t[0].slice(0, -1).forEach((op, i) => { early = op === '+' ? early + v[i + 1] : early - v[i + 1]; });
      expect(q.options.map(num), q.prompt).toContain(early);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(num(o)).toBeGreaterThanOrEqual(1); expect(num(o)).toBeLessThanOrEqual(CEILING[d]); }
    }
  });

  it('every prompt is ≤ 60 characters and fits the card (#1051); every card has its own safe `say`', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(MAX);
      expect(q.say, q.prompt).toBeTruthy();
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
