// #2318 (y3-an): the why names the first sound of the word after the gap, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { anWhy } from '../../src/curriculum/year3-an';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y3-an says why (#2318)', () => {
  it('names the sound and the article, in all four cases', () => {
    expect(anWhy('owl', true)).toBe('owl starts with a vowel sound, so we say an.');
    expect(anWhy('hour', true)).toContain('silent h');
    expect(anWhy('unicorn', false)).toContain('"yoo"');
    expect(anWhy('cat', false)).toBe('cat starts with a consonant sound, so we say a.');
  });
  it('gives every question a why that matches its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = TOPICS.find(x => x.id === 'y3-an')!.gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).toMatch(q.answer === 'an' ? /vowel sound/ : /consonant sound/);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
