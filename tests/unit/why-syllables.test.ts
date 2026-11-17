// #2318: r-syllables and y1-syllables say why after a wrong slice.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { BEAT_SPLIT, BEAT_WORDS } from '../../src/curriculum/syllables';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('beat splits (#2318)', () => {
  it('every word of two or more beats has a split with that many parts that spells the word', () => {
    for (const [w, n] of BEAT_WORDS) {
      if (n === 1) { expect(BEAT_SPLIT[w]).toBeUndefined(); continue; }
      expect(BEAT_SPLIT[w].split('-')).toHaveLength(n);
      expect(BEAT_SPLIT[w].replace(/-/g, '')).toBe(w);
    }
  });
});

describe('syllable games say why (#2318)', () => {
  it.each(['r-syllables', 'y1-syllables'])('%s: the why matches the answer', id => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(id)(d, rngOf(s));
      const n = Number(q.answer);
      const m = q.why!.match(/^([a-z-]+?)( is one beat: clap once|: clap (\d) times)\.$/);
      expect(m).not.toBeNull();
      expect(m![3] ? Number(m![3]) : 1).toBe(n);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
