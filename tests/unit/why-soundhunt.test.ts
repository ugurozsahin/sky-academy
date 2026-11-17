// #2318: r-soundhunt and y1-soundhunt (soundQ) say why after a wrong slice: the three words and where the sound sits.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('sound hunt games say why (#2318)', () => {
  it.each(['r-soundhunt', 'y1-soundhunt'])('%s: the why names the three spoken words, the place and the sound', id => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(id)(d, rngOf(s));
      const words = String(q.listen).split(' · ');
      const m = /^(.+) (start with|end with|have in the middle) "([^"]+)"\.$/.exec(q.why ?? '');
      expect(m, `${q.why}`).not.toBeNull();
      expect(m![1]).toBe(words.join(', '));
      expect(m![3]).toBe(q.answer);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
