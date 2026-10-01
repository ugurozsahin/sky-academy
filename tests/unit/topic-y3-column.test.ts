import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `topic-y3-mental.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-column')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
/** Independent oracle: read `a ± b` from the prompt alone. */
function parse(prompt: string) {
  const m = prompt.match(/^(\d{3}) ([+−]) (\d{2,3}) = \?$/)!;
  expect(m, prompt).toBeTruthy();
  const a = Number(m[1]), b = Number(m[3]);
  return { a, b, add: m[2] === '+', answer: m[2] === '+' ? a + b : a - b };
}
const exchanges = (a: number, b: number, add: boolean) => [10, 100, 1000].filter(m => add ? a % m + b % m >= m : m < 1000 && a % m < b % m).length;

describe('y3-column (#1084)', () => {
  it('is registered once, in Year 3, from d1 as a build topic', () => {
    expect(TOPICS.filter(t => t.id === 'y3-column')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.sequenceFrom).toBe(1);
  });

  it('d1–d2: the answer is the prompt arithmetic and `sequence` is its digits in order', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1084_100)) {
      const { answer } = parse(c.prompt);
      expect(Number(c.answer.replace(',', '')), c.prompt).toBe(answer);
      expect(c.sequence!.join(''), c.prompt).toBe(String(answer));
    }
  });

  it('every build card launches the same bubble count and keeps the sum on the card', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1084_200)) {
      // a repeated digit is sliced twice but is one option, so the launch is the sequence plus the decoys
      expect(c.sequence!.length + c.options.length - new Set(c.sequence).size, c.prompt).toBe(7);
      expect(c.sequence!.length, c.prompt).toBeLessThanOrEqual(4);
      expect(c.build!.template, c.prompt).toBe(c.answer.replace(/\d/g, '_'));
      expect(c.prompt, c.prompt).toMatch(/ = \?$/);
    }
  });

  it('d1: at most one exchange, subtraction takes a 2-digit number with none', () => {
    const cards = draws(1, 1084_300).map(c => parse(c.prompt));
    expect(new Set(cards.map(x => x.add)).size).toBe(2);
    for (const { a, b, add, answer } of cards) {
      expect(answer).toBeLessThanOrEqual(999);
      if (add) expect(exchanges(a, b, true)).toBeLessThanOrEqual(1);
      else { expect(b).toBeLessThan(100); expect(exchanges(a, b, false)).toBe(0); }
    }
  });

  it('d2: additions with two exchanges reach 1,000+, subtractions exchange, some across a zero', () => {
    const cards = draws(2, 1084_400).map(c => parse(c.prompt));
    const adds = cards.filter(x => x.add), subs = cards.filter(x => !x.add);
    expect(adds.length).toBeGreaterThan(100);
    expect(subs.length).toBeGreaterThan(100);
    for (const { a, b } of adds) expect([10, 100].filter(m => a % m + b % m >= m), `${a} + ${b}`).toHaveLength(2);
    for (const { a, b } of subs) expect(exchanges(a, b, false)).toBeGreaterThanOrEqual(1);
    expect(adds.some(x => x.answer >= 1000)).toBe(true);
    expect(subs.some(x => Math.floor(x.a / 10) % 10 === 0)).toBe(true);
    for (const c of draws(2, 1084_410)) if (c.answer.includes(',')) expect(c.build!.template).toMatch(/^_,___$/);
  });

  it('d3: exactly one of the four digits completes the equation', () => {
    for (const c of draws(3, 1084_500)) {
      const m = c.prompt.match(/^Missing digit: (\d*)_(\d*) ([+−]) (\d+) = (\d+)$/)!;
      expect(m, c.prompt).toBeTruthy();
      const [, head, tail, op, b, res] = m;
      expect(c.sequence, c.prompt).toBeUndefined();
      expect(c.options, c.prompt).toHaveLength(4);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      const fits = c.options.filter(o => {
        const a = Number(head + o + tail);
        return (op === '+' ? a + Number(b) : a - Number(b)) === Number(res);
      });
      expect(fits, c.prompt).toEqual([c.answer]);
    }
  });
});
