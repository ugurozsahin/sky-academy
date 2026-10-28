import { describe, it, expect } from 'vitest';
import { Y1_STORIES } from '../../src/curriculum/stories-y1';
import { Y2_STORIES } from '../../src/curriculum/stories-y2';
import { storyBankProblems } from '../../src/curriculum/story-bank';

const inStory = (story: string, w: string): boolean => (story.toLowerCase().replace(/'s\b/g, '').match(/[a-z']+/g) ?? [] as string[]).includes(w.toLowerCase());

// Covers only that a decoy is named in the story. It cannot see a decoy who also fits the answer (a second
// character doing the same thing), so a new Who item still needs that read by hand.
describe('#2320 Story Time "Who" decoys are in the story', () => {
  for (const [name, bank] of [['y1-storytime', Y1_STORIES], ['y2-storytime', Y2_STORIES]] as const) {
    it(`${name}: every decoy of a Who question is named in the story`, () => {
      const who = bank.filter(i => /^Who\b/.test(i.question));
      expect(who.length).toBeGreaterThan(8);
      for (const i of who)
        for (const d of i.decoys) expect(inStory(i.story, d), `${i.question} → ${d}`).toBe(true);
    });
    it(`${name}: the bank still passes its own checker`, () => {
      expect(storyBankProblems(bank)).toEqual([]);
    });
  }
});
