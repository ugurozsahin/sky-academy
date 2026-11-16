// #2318: r-capitals and r-tricky say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('Reception letter topics say why (#2318)', () => {
  it.each([1, 2, 3] as const)('r-capitals pairs the shown letter with its answer at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-capitals')(d, rngOf(s));
      const shown = (q.visual as { text: string }).text;
      const upper = shown === shown.toUpperCase();
      expect(q.why).toBe(upper ? `Big ${shown}, small ${q.answer}: the same letter.` : `Small ${shown}, big ${q.answer}: the same letter.`);
      expect(q.answer.toLowerCase()).toBe(shown.toLowerCase());
    }
  });
  it.each([1, 2, 3] as const)('r-tricky names the word that was heard at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-tricky')(d, rngOf(s));
      expect(q.why).toBe(`The word is ${q.answer}.`);
    }
  });
});
