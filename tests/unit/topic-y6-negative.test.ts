import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { STORIES } from '../../src/curriculum/year6-negative';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-negative')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1253 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace('−', '-'));
const nums = (s: string) => (s.match(/−?\d+/g) ?? []).map(num);

/** The answer re-derived from the prompt alone, per card shape. */
function oracle(q: Question): number {
  let m: RegExpMatchArray | null;
  if ((m = q.prompt.match(/^How many degrees from (\S+) °C to (\S+) °C\?/))) return num(m[2]) - num(m[1]);
  if ((m = q.prompt.match(/^(\S+) ([+−]) (\d+) = \?$/))) return m[2] === '+' ? num(m[1]) + Number(m[3]) : num(m[1]) - Number(m[3]);
  const [a, b] = nums(q.prompt.replace(/\(.*\)/, ''));
  if (/falls|goes down/.test(q.prompt)) return a - b;
  if (/rises|goes up/.test(q.prompt)) return a + b;
  if (/warmer is the room/.test(q.prompt)) return b - a;
  throw new Error(`no oracle for ${q.prompt}`);
}

describe('y6-negative (#1253)', () => {
  it('is registered for Year 6 maths', () => { expect(topic.year).toBe('year6'); expect(topic.subject).toBe('maths'); });

  it('the oracle holds on every card: 300 draws per difficulty, answers −30..30, four distinct options, real minus only', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(num(q.answer), q.prompt).toBe(oracle(q));
      expect(num(q.answer)).toBeGreaterThanOrEqual(-30); expect(num(q.answer)).toBeLessThanOrEqual(30);
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
      expect(q.prompt).not.toMatch(/\d-\d|(^|\s)-\d/);
      for (const o of q.options) { expect(o).not.toMatch(/-/); expect(o).toMatch(/^−?\d+$/); }
    }
  });

  it('d1 ends straddle zero and the interval is never negative', () => {
    for (const q of draw(1)) {
      const [a, b] = nums(q.prompt);
      expect(a).toBeLessThan(0); expect(b).toBeGreaterThan(0); expect(num(q.answer)).toBe(b - a);
      for (const o of q.options) expect(num(o)).toBeGreaterThan(0);
    }
  });

  it('d2 offers the sign flip whenever it is in range, and the answer crosses or sinks below zero', () => {
    for (const q of draw(2)) {
      const a = num(q.answer); expect(Math.abs(a)).toBeLessThanOrEqual(20);
      expect(q.options).toContain(a === 0 ? q.answer : (a < 0 ? `${-a}` : `−${a}`));
    }
  });

  it('d3 story templates give known answers for fixed numbers', () => {
    const by = Object.fromEntries(STORIES.map(s => [s.id, s]));
    expect(by.fall.make(6, 11).answer).toBe(-5);
    expect(by.rise.make(-4, 7).answer).toBe(3);
    expect(by['lift-down'].make(2, 5).answer).toBe(-3);
    expect(by['lift-up'].make(-3, 5).answer).toBe(2);
    expect(by.submarine.make(-12, 5).answer).toBe(-7);
    expect(by.freezer.make(-4, 9).answer).toBe(13);
    expect(STORIES.length).toBeLessThanOrEqual(8);
    for (const s of STORIES) for (let i = 0; i < 50; i++) {
      const r = rng(i + 7), [x, y] = s.pickArgs(r), a = s.make(x, y).answer;
      if (s.id !== 'freezer') expect(Math.sign(a) !== Math.sign(x), `${s.id} ${x} ${y}`).toBe(true);
    }
  });

  it('say reads a sign as "negative" and never carries a raw minus, degree sign or hyphen', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 200)) {
      expect(q.say ?? '').not.toMatch(/[−°-]/);
      if (/^−|from −| −\d/.test(q.prompt.replace(/ − \d/g, ''))) expect(q.say).toContain('negative');
      if (/ − \d+ = \?$/.test(q.prompt)) expect(q.say).toContain('minus');
    }
  });

  it('leak limit: at most 30% of in-scope cards have a last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) expect(leakShares(topic.gen, d, 2000, { skipLeading: true }).units).toBeLessThanOrEqual(0.3);
  });
});
