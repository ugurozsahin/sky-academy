// #2318 (y6-consistency): the why names the subject and its number, or the tense the time words set.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { agreeWhy, tenseWhy } from '../../src/curriculum/year6-consistency';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-consistency')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-consistency says why (#2318)', () => {
  it('words each case', () => {
    expect(agreeWhy('The dogs _ hungry.', 'are')).toBe('The subject is dogs: more than one, so are.');
    expect(agreeWhy('The box of pencils _ on the desk.', 'is')).toBe('The subject is box, not pencils: one, so is.');
    expect(agreeWhy('Each of the pupils _ a book.', 'has')).toBe('The subject is each, not pupils: one, so has.');
    expect(tenseWhy('will visit')).toMatch(/ahead/);
    expect(tenseWhy('washed')).toMatch(/past/);
    expect(tenseWhy('cooks')).toMatch(/now/);
  });
  it('every draw has a short why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why).toContain(q.answer);
    }
  });
});
