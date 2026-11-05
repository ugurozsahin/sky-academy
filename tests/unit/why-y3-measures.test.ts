// #2317 (y3-measures): the why gives the scale step, the sum, or the unit change behind the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-measures')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };
const num = (s: string) => Number(s.replace(/[^\d]/g, ''));

describe('y3-measures why (#2317)', () => {
  it('d1: the gap size, then the marked value', () => {
    for (const q of draw(1)) {
      const m = /^Each gap is ([\d,]+) (\w+), so the mark is ([\d,]+) \2\.$/.exec(q.why!);
      expect(m, q.why).toBeTruthy();
      expect(`${m![3]} ${m![2]}`).toBe(q.answer);
    }
  });
  it('d2: has a why that fits 14 words', () => {
    for (const q of draw(2)) { expect(q.why, q.prompt).toBeTruthy(); expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14); }
  });
  it('d2: a sum or take-away why states a true sum', () => {
    for (const q of draw(2)) {
      const m = /^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+) \w+\.$/.exec(q.why!);
      if (!m) continue;
      expect(m[2] === '+' ? num(m[1]) + num(m[3]) : num(m[1]) - num(m[3])).toBe(num(m[4]));
      expect(m[4]).toBe(q.answer.split(' ')[0]);
    }
  });
  it('d3: the unit change is arithmetic that lands on the answer', () => {
    for (const q of draw(3)) {
      const w = q.why!;
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      const nums = w.match(/\d[\d,]*/g)!.map(num);
      expect(nums[nums.length - 1]).toBe(num(q.answer));
    }
  });
});
