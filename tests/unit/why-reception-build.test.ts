// #2318: r-sounds and r-build say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('Reception r-sounds and r-build say why (#2318)', () => {
  it.each([1, 2, 3] as const)('r-sounds names the word and the sound at difficulty %i', d => {
    for (let s = 1; s <= 200; s++) {
      const q = gen('r-sounds')(d, rngOf(s));
      const m = q.why!.match(/^(\w+) (starts with|ends with) (\w): say it slowly\.$/) ?? q.why!.match(/^(\w+): the (middle) sound is (\w)\.$/);
      expect(m).not.toBeNull();
      const [, w, kind, l] = m!;
      expect(kind === 'starts with' ? w[0] : kind === 'ends with' ? w[2] : w[1]).toBe(l);
    }
  });
  it.each([1, 2, 3] as const)('r-build spells the word sound by sound at difficulty %i', d => {
    for (let s = 1; s <= 200; s++) {
      const q = gen('r-build')(d, rngOf(s));
      const m = q.why!.match(/^([a-z]+(?:-[a-z]+)*): (\w+)\. Say each sound, then blend\.$/);
      expect(m).not.toBeNull();
      expect(m![1].replace(/-/g, '')).toBe(m![2]);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
