import { describe, it, expect } from 'vitest';
import { y2StoryTimes, TIMES, SHARE, GROUP } from '../../src/curriculum/year2-story-times';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const DRAWS = 300;
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const kindOf = (prompt: string): 'times' | 'divide' => {
  const starts = (bank: string[]) => bank.some(t => prompt.startsWith(t.split(/\{\w\}/)[0]) && prompt.endsWith(t.split(/\}/).pop()!));
  return starts(TIMES) && !starts(SHARE) && !starts(GROUP) ? 'times' : 'divide';
};

describe('y2-story-times (#995)', () => {
  for (const d of [1, 2, 3] as const) {
    it(`d${d}: the answer is the template's operation on the prompt's two numbers, within the 2, 5, 10 tables`, () => {
      const rng = mulberry32(995 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = y2StoryTimes(d, rng);
        const [a, b] = nums(q.prompt);
        expect(a).toBeDefined(); expect(b).toBeDefined();
        const times = kindOf(q.prompt) === 'times';
        if (times) expect(Number(q.answer)).toBe(a * b);
        else { expect(a % b).toBe(0); expect(Number(q.answer)).toBe(a / b); }
        expect([2, 5, 10]).toContain(times ? [a, b].find(x => [2, 5, 10].includes(x))! : b);
        expect(q.prompt.length).toBeLessThanOrEqual(83);
        expect(q.say).toBeTruthy();
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.answer);
        for (const o of q.options) expect(Number(o)).toBeLessThanOrEqual(100);
      }
    });
  }

  it('follows the ladder: d1 is × with an array that matches, d2 is ÷ and d3 mixes, neither with a visual', () => {
    const rng = mulberry32(7);
    let times3 = 0;
    for (let i = 0; i < DRAWS; i++) {
      const q1 = y2StoryTimes(1, rng);
      expect(kindOf(q1.prompt)).toBe('times');
      expect(q1.visual).toMatchObject({ type: 'array' });
      const v = q1.visual as { rows: number; cols: number };
      expect(v.rows * v.cols).toBe(Number(q1.answer));
      expect(v.rows).toBeLessThanOrEqual(3); expect(v.cols).toBeLessThanOrEqual(10);
      const q2 = y2StoryTimes(2, rng);
      expect(kindOf(q2.prompt)).toBe('divide'); expect(q2.visual).toBeUndefined();
      const q3 = y2StoryTimes(3, rng);
      expect(q3.visual).toBeUndefined();
      if (kindOf(q3.prompt) === 'times') times3++;
    }
    expect(times3).toBeGreaterThan(50); expect(times3).toBeLessThan(DRAWS - 50);
  });

  it('offers the numbers-added slip as a decoy whenever it is in range', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < DRAWS; i++) {
      const q = y2StoryTimes(1, rng);
      const [a, b] = nums(q.prompt);
      expect(q.options.map(Number)).toContain(a + b);
    }
  });
});
