// #2318 (y4-adverbials): the why gives the test for the answer, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { advWhy } from '../../src/curriculum/year4-adverbials';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-adverbials')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y4-adverbials says why (#2318)', () => {
  it('words each form', () => {
    expect(advWhy('comma', 'After lunch')).toBe('The comma goes after "After lunch", the words that start the sentence.');
    expect(advWhy('fit', 'At noon')).toBe('"At noon" tells us when or where, so it starts the sentence.');
  });
  it.each([1, 2, 3] as Difficulty[])('d%i: every question has a short why that is not the answer', d => {
    for (const q of draws(d)) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      expect(q.why).not.toMatch(/undefined/);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
