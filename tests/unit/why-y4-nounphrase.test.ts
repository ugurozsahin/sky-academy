// #2318 (y4-nounphrase): the why gives the test for the answer, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { npWhy } from '../../src/curriculum/year4-nounphrase';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-nounphrase')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y4-nounphrase says why (#2318)', () => {
  it('words each form', () => {
    expect(npWhy('gap', 'fluffy', 'dog')).toBe('"fluffy" can describe the dog, so it expands the noun phrase.');
    expect(npWhy('spot', 'the big red bus')).toBe('It has a noun with describing words around it.');
    expect(npWhy('head', 'teacher')).toBe('The phrase is about the teacher; the other words describe it.');
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
