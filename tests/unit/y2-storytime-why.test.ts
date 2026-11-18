import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { Y2_STORIES } from '../../src/curriculum/stories-y2';
import { storyBankQ } from '../../src/curriculum/story-bank';
import type { Difficulty, Rng } from '../../src/curriculum';

const rng = (seed: number): Rng => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('y2-storytime why (#2318)', () => {
  it('every bank item quotes its evidence, inside the KS1 eight-word limit', () => {
    for (const item of Y2_STORIES) {
      const q = storyBankQ(item, rng(1), true);
      expect(q.why, item.question).toBe(`"${item.evidence}"`);
      expect(item.story, item.question).toContain(item.evidence);
      expect(item.evidence.split(/\s+/).length, item.evidence).toBeLessThanOrEqual(8);
    }
  });
  it('without the switch a story question has no why', () => {
    expect(storyBankQ(Y2_STORIES[0], rng(1)).why).toBeUndefined();
  });
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: every drawn question has a why`, () => {
      const t = TOPICS.find(x => x.id === 'y2-storytime')!;
      const r = rng(2318 + d);
      for (let i = 0; i < 200; i++) expect(t.gen(d, r).why).toBeTruthy();
    });
  }
});
