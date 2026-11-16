// #2318: r-capitals and r-tricky say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('Reception letter topics say why (#2318)', () => {
  it('r-capitals pairs the big and small letter, and the pair is the answer', () => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-capitals')(2, rngOf(s));
      expect(q.why).toMatch(/^(Big|Small) \S, (small|big) \S: the same letter\.$/);
      expect(q.why).toContain(q.answer);
    }
  });
  it('r-tricky names the word that was heard', () => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-tricky')(3, rngOf(s));
      expect(q.why).toBe(`The word is ${q.answer}.`);
    }
  });
});
