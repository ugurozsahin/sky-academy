// #2318: r-read and r-storytime say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { R_STORIES } from '../../src/curriculum/stories-r';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('Reception reading topics say why (#2318)', () => {
  it.each([1, 2, 3] as const)('r-read says the word that was sounded out at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-read')(d, rngOf(s));
      const word = (q.visual as { text: string }).text;
      expect(q.why).toBe(`Blend the sounds: it says ${word}.`);
      expect(q.why).not.toContain(q.answer);
    }
  });
  it.each([1, 2, 3] as const)('r-storytime quotes the story words that settle it at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-storytime')(d, rngOf(s));
      const quoted = q.why!.slice(1, -1);
      expect(q.why).toBe(`"${quoted}"`);
      expect(q.story, q.why).toContain(quoted);
    }
    for (const i of R_STORIES) expect(i.evidence.split(/\s+/).length).toBeLessThanOrEqual(8);
  });
});
