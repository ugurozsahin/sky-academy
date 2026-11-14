// #2318 (y4-plural-poss): the why gives the reason for the apostrophe, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { possWhy } from '../../src/curriculum/year4-plural-poss';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = () => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-plural-poss')!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y4-plural-poss says why (#2318)', () => {
  it('words each case', () => {
    expect(possWhy('plain', 'girl', 'girls')).toBe('A verb follows the gap, so nothing is owned: a plain plural.');
    expect(possWhy('one', 'girl', 'girls')).toBe('One girl is the owner, so the apostrophe goes before the s.');
    expect(possWhy('regular', 'girl', 'girls')).toBe('"girls" already ends in s, so the apostrophe goes after it.');
    expect(possWhy('irregular', 'child', 'children')).toBe('"children" does not end in s, so add \'s like a singular.');
  });
  it('every question has a short why that matches its prompt and is not the answer', () => {
    for (const q of draws()) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      expect(q.why).not.toMatch(/undefined/);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      if (q.prompt === 'Which word fits the gap?') expect(q.why).toContain('plain plural');
      else if (q.why!.startsWith('One ')) expect(q.answer).toMatch(/'s$/);
      else if (q.why!.includes('after it')) expect(q.answer).toMatch(/s'$/);
    }
  });
});
