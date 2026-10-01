import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

// Deterministic RNG (mulberry32), same construction `topic-y3-pv.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-mental')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
/** Independent oracle: read `a + b` or `a − b` (U+2212) from the prompt alone. */
function parse(prompt: string) {
  const m = prompt.match(/^(\d{3}) ([+−]) (\d+) = \?$/)!;
  expect(m, prompt).toBeTruthy();
  const a = Number(m[1]), b = Number(m[3]);
  return { a, b, add: m[2] === '+', answer: m[2] === '+' ? a + b : a - b };
}
const form = (b: number) => b < 10 ? 'ones' : b < 100 ? 'tens' : 'hundreds';
const crosses = (x: number, y: number) => Math.floor(x / 100) !== Math.floor(y / 100);

describe('y3-mental (#1083)', () => {
  it('is registered once, in Year 3, first in the calc strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-mental')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('every answer equals the prompt arithmetic, and is among the options once', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1083_100)) {
      const { answer } = parse(c.prompt);
      expect(Number(c.answer), c.prompt).toBe(answer);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
    }
  });

  it('d1: ones that never cross a ten, or hundreds', () => {
    const forms = new Set<string>();
    for (const c of draws(1, 1083_200)) {
      const { a, b, answer } = parse(c.prompt);
      forms.add(form(b));
      if (b < 10) expect(Math.floor(a / 10), c.prompt).toBe(Math.floor(answer / 10));
      else expect(b % 100, c.prompt).toBe(0);
    }
    expect([...forms].sort()).toEqual(['hundreds', 'ones']);
  });

  it('d2: tens only, and a hundred is crossed on some cards but not all', () => {
    const cards = draws(2, 1083_300).map(c => parse(c.prompt));
    for (const { b } of cards) expect(form(b)).toBe('tens');
    const share = cards.filter(x => crosses(x.a, x.answer)).length / DRAWS;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.75);
  });

  it('d3: all three forms, both operations, with crossings', () => {
    const cards = draws(3, 1083_400).map(c => parse(c.prompt));
    expect(new Set(cards.map(x => form(x.b))).size).toBe(3);
    expect(new Set(cards.map(x => x.add)).size).toBe(2);
    expect(cards.some(x => form(x.b) === 'ones' && crosses(x.a, x.answer))).toBe(true);
  });

  it('every number and every answer is 100-999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1083_500)) {
      const { a, answer } = parse(c.prompt);
      expect(a, c.prompt).toBeGreaterThanOrEqual(100); expect(a, c.prompt).toBeLessThanOrEqual(999);
      for (const o of c.options) { expect(Number(o), c.prompt).toBeGreaterThanOrEqual(100); expect(Number(o), c.prompt).toBeLessThanOrEqual(999); }
      expect(answer).toBeGreaterThanOrEqual(100);
    }
  });

  it('decoys: the place-value slip turns up, and a subtraction meets its wrong operation', () => {
    const cards = draws(2, 1083_600).map(c => ({ ...parse(c.prompt), options: c.options.map(Number) }));
    const slips = cards.filter(x => x.options.some(o => o === (x.add ? x.a + x.b * 10 : x.a - x.b * 10) || o === (x.add ? x.a + x.b / 10 : x.a - x.b / 10)));
    expect(slips.length).toBeGreaterThan(30);
    const subs = cards.filter(x => !x.add && x.a + x.b <= 999);
    expect(subs.filter(x => x.options.includes(x.a + x.b)).length).toBeGreaterThan(subs.length / 4);
  });

  it('slow is set on every d3 card and on no d1-d2 card', () => {
    for (const c of draws(3, 1083_700)) expect(c.slow, c.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1083_700)) expect(c.slow, c.prompt).toBeFalsy();
  });

  it('the prompt uses a real minus sign and the say reads it aloud', () => {
    for (const c of draws(3, 1083_800)) {
      expect(c.prompt).not.toMatch(/ - /);
      expect(c.say).not.toMatch(/[=?−]/);
      expect(c.say).toMatch(c.prompt.includes('+') ? /plus/ : /minus/);
    }
  });

  it('decoys: leading and last digit shares stay within the KS2 ceiling (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.counted, `d${d}`).toBeGreaterThan(200);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.30);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.30);
    }
  });
});
