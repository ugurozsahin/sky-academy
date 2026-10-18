import { describe, it, expect } from 'vitest';
import { storyBankQ, storyBankProblems, storyGen, STORY_MAX_CHARS, type StoryItem } from '../../src/curriculum/story-bank';
import { seededRng } from '../../src/game/rng';

const good: StoryItem = { story: 'Tom has a red kite. He flies it at the park.', question: 'What colour is the kite?', answer: 'red', decoys: ['blue', 'green', 'pink'], evidence: 'a red kite', kind: 'literal', d: 1 };
const bad = (extra: Partial<StoryItem>) => storyBankProblems([{ ...good, ...extra }]);

describe('storyBankQ (#1017)', () => {
  const q = storyBankQ(good, seededRng(1));
  it('says the story and the question as one line, and sets story', () => {
    expect(q.prompt).toBe(good.question);
    expect(q.say).toBe(`${good.story} ${good.question}`);
    expect(q.story).toBe(good.story);
    expect(q.visual).toBeUndefined();
    expect(q.hint).toBeUndefined();
  });
  it('has the answer among the options', () => {
    expect(q.answer).toBe('red');
    expect(q.options).toContain('red');
    expect(q.options).toHaveLength(4);
  });
  it('storyGen draws an item of the asked difficulty', () => {
    const hard = { ...good, d: 3 as const, answer: 'blue', decoys: ['red', 'green', 'pink'] };
    expect(storyGen([good, hard])(3, seededRng(2)).answer).toBe('blue');
  });
});

describe('storyBankProblems (#1017)', () => {
  it('returns [] for a good bank', () => expect(storyBankProblems([good])).toEqual([]));
  it('flags each broken rule', () => {
    expect(bad({ story: 'One. Two. Three. Four red kite.' })[0]).toMatch(/sentences/);
    expect(bad({ story: 'a red kite ' + 'x'.repeat(STORY_MAX_CHARS) })).toEqual(expect.arrayContaining([expect.stringMatching(/characters/)]));
    expect(bad({ evidence: 'a blue kite' })[0]).toMatch(/evidence/);
    expect(bad({ answer: 'yellow' })[0]).toMatch(/not in the story/);
    expect(bad({ decoys: ['red', 'green', 'pink'] })[0]).toMatch(/among its decoys/);
    expect(bad({ decoys: ['blue', 'blue', 'pink'] })[0]).toMatch(/duplicate/);
    expect(bad({ decoys: ['blue', 'ass', 'pink'] })[0]).toMatch(/avoided/);
    expect(bad({ story: 'Tom has a red kite _.' })[0]).toMatch(/_/);
  });
  it('a 161-character story is flagged, 160 is not', () => {
    const pad = (n: number) => 'Tom has a red kite' + 'e'.repeat(n - 19) + '.';
    expect(pad(160)).toHaveLength(160);
    expect(bad({ story: pad(160) })).toEqual([]);
    expect(bad({ story: pad(161) })[0]).toMatch(/161 characters/);
  });
  it('a literal answer may stand in through its word; an inference need not be in the story', () => {
    expect(bad({ answer: '🪁', word: 'kite' })).toEqual([]);
    expect(bad({ kind: 'inference', answer: 'happy', decoys: ['sad', 'cross', 'tired'] })).toEqual([]);
  });
});
