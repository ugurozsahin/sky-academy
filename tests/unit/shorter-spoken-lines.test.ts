// #2323: the spoken line of five slow games must fit inside the time the bubbles stay up.
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const words = (t: string) => t.trim().split(/\s+/).length;
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('shorter spoken lines (#2323)', () => {
  it.each([1, 2, 3] as const)('r-balance speaks at most 5 words at difficulty %i', d => {
    for (let i = 0; i < 200; i++) expect(words(gen('r-balance')(d, rng(i + 1)).say!)).toBeLessThanOrEqual(5);
  });
  it.each(['y2-story-add', 'y2-story-money'])('%s at difficulty 1 is at most 8 words and carries a picture', id => {
    for (let i = 0; i < 200; i++) {
      const q = gen(id)(1, rng(i + 1));
      expect(words(q.prompt), q.prompt).toBeLessThanOrEqual(8);
      expect(q.visual, q.prompt).toBeTruthy();
      // Spoken, the amounts say "pence" in full (a speech engine misreads "47p"), so the money line may run to 10.
      expect(words(q.say!), q.say).toBeLessThanOrEqual(id === 'y2-story-money' ? 10 : 8);
    }
  });
  it.each(['y2-story-add', 'y2-story-money'])('%s pictures always carry an emoji', id => {
    for (const d of [1, 2, 3] as const) for (let i = 0; i < 100; i++) {
      const v = gen(id)(d, rng(i + 1)).visual as { type: string; emoji?: string; text?: string };
      expect(v.type).toBe('word');
      expect(v.emoji, id).toMatch(/\S/);
      expect(v.emoji, id).not.toContain('undefined');
    }
  });
  it.each(['y2-story-add', 'y2-story-money'])('%s carries a picture at every difficulty', id => {
    for (const d of [2, 3] as const) for (let i = 0; i < 100; i++) expect(gen(id)(d, rng(i + 1)).visual).toBeTruthy();
  });
  it('y4-whichop speaks complete, question-marked sentences', () => {
    for (const d of [1, 2, 3] as const) {
      for (let i = 0; i < 200; i++) {
        const q = gen('y4-whichop')(d, rng(i + 1));
        expect(q.say, q.prompt).toMatch(/\? Which operation solves it\?$/);
      }
    }
  });
});
