import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { duelPool, seededRng } from '../../src/game/duel';
import { mixable, subjectPool } from '../../src/game/pools';
import { storyBankProblems } from '../../src/curriculum/story-bank';
import { Y4_NONFICTION } from '../../src/curriculum/stories-y4';

const topic = TOPICS.find(t => t.id === 'y4-retrieve')!;
const D: Difficulty[] = [1, 2, 3];
// AVOID is a gap-spelling denylist, not every crude whole word (#1130, G13).
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt', 'sex', 'wee', 'poo']);

describe('y4-retrieve (#1130)', () => {
  it('is registered once on the Year 4 writing tab, solo', () => {
    expect(TOPICS.filter(t => t.id === 'y4-retrieve')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing', solo: true, title: 'Retrieving Information' });
  });

  it('never reaches a mixed mode or the duel', () => {
    expect(mixable(topic)).toBe(false);
    expect(subjectPool(TOPICS, 'writing').map(t => t.id)).not.toContain('y4-retrieve');
    expect(duelPool(TOPICS.filter(t => t.year === 'year4'), 1).map(t => t.id)).not.toContain('y4-retrieve');
  });

  it('the bank breaks none of the story rules, and has ten passages', () => {
    expect(storyBankProblems(Y4_NONFICTION)).toEqual([]);
    expect(new Set(Y4_NONFICTION.map(i => i.story)).size).toBe(10);
  });

  it.each(D)('d%i has at least six questions, so repeat avoidance has room', d => {
    expect(Y4_NONFICTION.filter(i => i.d === d).length).toBeGreaterThanOrEqual(6);
  });

  it('every item is literal, with options of at most eight characters', () => {
    for (const i of Y4_NONFICTION) {
      expect(i.kind, i.question).toBe('literal');
      for (const w of [i.answer, ...i.decoys]) expect(w.length, `${i.question}: ${w}`).toBeLessThanOrEqual(8);
    }
  });

  it('no decoy is stated in the passage as the answer to a question about it: none is the answer of a sibling', () => {
    for (const i of Y4_NONFICTION) expect(i.decoys, i.question).not.toContain(i.answer);
  });

  it('no question asks for a prediction or an opinion (#666)', () => {
    for (const i of Y4_NONFICTION) expect(i.question, i.question).not.toMatch(/\b(next|will|going to|think|best|favourite)\b/i);
  });

  it('no bank word is crude', () => {
    for (const i of Y4_NONFICTION)
      for (const w of [i.story, i.question, i.answer, ...i.decoys].join(' ').toLowerCase().match(/[a-z']+/g)!)
        expect(EXCLUDE.has(w), w).toBe(false);
  });

  it('every question is the one asked, spoken after its passage, with the answer among the options', () => {
    const rng = seededRng(1130);
    for (const d of D) for (let n = 0; n < 150; n++) {
      const q = topic.gen(d, rng);
      const item = Y4_NONFICTION.find(i => i.question === q.prompt && i.story === q.story)!;
      expect(item, q.prompt).toBeDefined();
      expect(item.d).toBe(d);
      expect(q.say).toBe(`${item.story} ${item.question}`);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
