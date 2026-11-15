// #2318 (y6-clauses): the mark, the gap and the can/cannot card each name the rule; the can/cannot why matches the pair drawn.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { CAN_WHY, CANNOT_WHY, COLON_WHY, DASH_WHY, BOUNDARY_WHY, SEMICOLON_WHY } from '../../src/curriculum/year6-clauses';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-clauses')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-clauses says why (#2318)', () => {
  it('every draw has a why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); }
  });
  it('the why matches the answer on each card', () => {
    for (const q of draws(1)) expect(q.why).toBe(SEMICOLON_WHY);
    for (const q of draws(2)) {
      const want = q.answer === ':' ? COLON_WHY : q.answer === '–' ? DASH_WHY : BOUNDARY_WHY;
      expect(q.why).toBe(want);
    }
    for (const q of draws(3)) expect(q.why).toBe(q.answer === 'yes' ? CAN_WHY : CANNOT_WHY);
  });
});
