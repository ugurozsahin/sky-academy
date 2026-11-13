// #2318 (y3-conjunctions): the why applies the stress rule to the word, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { gapWhy, classWhy } from '../../src/curriculum/year3-conjunctions';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y3-conjunctions')!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y3-conjunctions says why (#2318)', () => {
  it('names the job of the word', () => {
    expect(gapWhy('because')).toBe('Because gives the reason.');
    expect(classWhy('since', 'adverb')).toBe('With since, nothing follows it, so it is an adverb.');
  });
  it('every question has a short why that is not the answer', () => {
    for (const q of draws) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
