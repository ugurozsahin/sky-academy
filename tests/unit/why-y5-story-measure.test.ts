// #2318: y5-story-measure says why: the working, as a number sentence ending in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y5-story-measure')!.gen;
const num = (s: string) => Number(s.replace(/[£,g]/g, ''));

describe('y5-story-measure says why (#2318)', () => {
  it('every sentence is true arithmetic ending in the answer, and short', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      expect(q.why, `d${d} seed ${s}`).toBeTruthy();
      const steps = q.why!.split(', ');
      expect(steps.length).toBeLessThanOrEqual(2);
      for (const step of steps) {
        const [lhs, rhs] = step.split(' = ');
        const t = lhs.split(' ').filter(x => x !== 'kg');
        if (t.length !== 3) { expect(step).toMatch(/^[\d.]+ kg = \d+ g$/); continue; }
        const [a, op, b] = [num(t[0]), t[1], num(t[2])];
        const v = op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : a / b;
        expect(v, q.why).toBeCloseTo(num(rhs), 6);
      }
      const last = steps[steps.length - 1].split(' = ').pop()!;
      expect(num(last), q.why).toBeCloseTo(num(q.answer), 6);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why, q.why).not.toBe(q.answer);
    }
  });
});
