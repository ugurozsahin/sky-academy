// #2317 (y5-mentalmd family): each why shows the table fact or the swap, and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 300 }, (_, s) => TOPICS.find(t => t.id === 'y5-mentalmd')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => parseInt(s.replace(/,/g, ''));

describe('y5-mentalmd whys (#2317)', () => {
  it('every question at every level has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) { expect(q.why, q.prompt).toBeTruthy(); expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14); }
  });
  it('a table-fact why is true arithmetic, and its zeros reach the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      const m = q.why!.match(/^(\d+) ([×÷]) (\d+) = (\d+), then (\d+) zeros? on$/)!; expect(m, q.why).toBeTruthy();
      const [a, b, r, z] = [num(m[1]), num(m[3]), num(m[4]), num(m[5])];
      expect(m[2] === '×' ? a * b : a / b, q.why).toBe(r);
      expect(r * 10 ** z, q.why).toBe(num(q.answer as string));
    }
  });
  it('level 3 never contradicts its answer', () => {
    for (const q of draws(3)) {
      const ans = num(q.answer as string);
      if (q.why!.includes('zero')) { const z = num(q.why!.match(/then (\d+) zero/)![1]); const base = q.why!.match(/= (\d+)(?:, then| ?$)/) ; expect(ans % 10 ** z, q.why).toBe(0); expect(base, q.why).toBeTruthy(); }
      else { const m = q.why!.match(/^(\d+) × (\d+) = (\d+) × (\d+) = (\d+)$/)!; expect(m, q.why).toBeTruthy(); expect(num(m[1]) * num(m[2]), q.why).toBe(num(m[3]) * num(m[4])); expect(num(m[5]), q.why).toBe(ans); }
    }
  });
});
