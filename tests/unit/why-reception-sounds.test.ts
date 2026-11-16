// #2318: r-rhyme and r-initial say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('Reception sound topics say why (#2318)', () => {
  it.each([1, 2, 3] as const)('r-rhyme names both words and the shared ending at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-rhyme')(d, rngOf(s));
      expect(q.why).toMatch(/^[a-z]+ and [a-z]+ both end in -[a-z]+\.$/);
      const [, a, b, ending] = q.why!.match(/^(\w+) and (\w+) both end in -(\w+)\.$/)!;
      expect(a.endsWith(ending) && b.endsWith(ending)).toBe(true);
    }
  });
  it.each([1, 2, 3] as const)('r-initial says the starting letter at difficulty %i', d => {
    for (let s = 1; s <= 100; s++) {
      const q = gen('r-initial')(d, rngOf(s));
      const kw = (q.visual as { text: string }).text;
      expect(q.why).toMatch(new RegExp(`^${kw} (and [a-z]+ both start with|starts with) ${kw[0]}`));
    }
  });
});
