// #2318: r-storyorder and y1-storyorder (storyQ) say why after a wrong slice: what makes the order.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { STORIES, WHYS } from '../../src/curriculum/story';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('story order games say why (#2318)', () => {
  it.each(['r-storyorder', 'y1-storyorder'])('%s: each story has its own short why', id => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(id)(d, rngOf(s));
      const story = STORIES.find(st => st.map(e => e[1]).join('') === q.answer)!;
      expect(q.why).toBe(WHYS[STORIES.indexOf(story)]);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(q.why).not.toBe(q.answer);
    }
  });

  it('has one why per story', () => { expect(WHYS.length).toBe(STORIES.length); });
});
