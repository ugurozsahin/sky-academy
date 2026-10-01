import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

// Deterministic RNG (mulberry32), same construction `topic-y3-mental.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-missing')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
/** Independent oracle: read `a op b = c` (either side first, "?" anywhere but the result) and solve for the gap. */
function parse(prompt: string) {
  const m = prompt.match(/^(?:(\S+) ([+−]) (\S+) = (\d+)|(\d+) = (\S+) ([+−]) (\S+))$/);
  expect(m, prompt).toBeTruthy();
  const left = !!m![5];
  const [a, op, b, c] = left ? [m![6], m![7], m![8], m![5]] : [m![1], m![2], m![3], m![4]];
  const add = op === '+';
  const gap = a === '?' ? 'a' : 'b';
  const value = gap === 'a' ? (add ? +c - +b : +c + +b) : (add ? +c - +a : +a - +c);
  const nums = [a, b, c].filter(n => n !== '?').map(Number);
  return { gap, add, left, value, nums, a, b, c };
}

describe('y3-missing (#1086)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-missing')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('every answer makes the equation true, and is among the options once', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1086_100)) {
      expect(Number(c.answer), c.prompt).toBe(parse(c.prompt).value);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
    }
  });

  it('d1: the gap is a multiple of 10 or 100, in the second place only', () => {
    const cards = draws(1, 1086_200).map(c => parse(c.prompt));
    for (const x of cards) { expect(x.gap).toBe('b'); expect(x.value % 10).toBe(0); expect(x.left).toBe(false); }
    expect(cards.some(x => x.value % 100 === 0)).toBe(true);
    expect(cards.some(x => x.value % 100 !== 0)).toBe(true);
  });

  it('d2: the gap sits in either position, with both operations, never left of the equals', () => {
    const cards = draws(2, 1086_300).map(c => parse(c.prompt));
    expect(new Set(cards.map(x => x.gap + x.add)).size).toBe(4);
    for (const x of cards) expect(x.left).toBe(false);
  });

  it('d3: the equals sign comes first on 40-60% of cards, and every card needs an exchange', () => {
    const cards = draws(3, 1086_400).map(c => parse(c.prompt));
    const share = cards.filter(x => x.left).length / DRAWS;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
    expect(new Set(cards.map(x => x.gap + x.add)).size).toBe(4);
  });

  it('every number and answer is 1-999, and no gap is 0', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1086_500)) {
      for (const n of [...parse(c.prompt).nums, ...c.options.map(Number)]) { expect(n, c.prompt).toBeGreaterThanOrEqual(1); expect(n, c.prompt).toBeLessThanOrEqual(999); }
    }
  });

  it('decoys: the wrong operation and the place-value shift both turn up', () => {
    const cards = draws(2, 1086_600).map(c => ({ ...parse(c.prompt), options: c.options.map(Number) }));
    const wrongOp = cards.filter(x => x.options.includes(x.gap === 'a' ? (x.add ? +x.c + +x.b : +x.c - +x.b) : +x.a + +x.c));
    expect(wrongOp.length).toBeGreaterThan(DRAWS / 4);
    expect(cards.filter(x => x.options.some(o => o === x.value * 10 || o * 10 === x.value)).length).toBeGreaterThan(30);
  });

  it('slow is set on every d3 card and on no d1-d2 card, and the say reads the sum aloud', () => {
    for (const c of draws(3, 1086_700)) expect(c.slow, c.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1086_700)) expect(c.slow, c.prompt).toBeFalsy();
    for (const c of draws(3, 1086_800)) { expect(c.prompt).not.toMatch(/ - /); expect(c.say).not.toMatch(/[=?−]/); expect(c.say).toMatch(/what/); }
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
