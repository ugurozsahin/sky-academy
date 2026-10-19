import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';
import { mixable, subjectPool } from '../../src/game/pools';
import { storyBankProblems } from '../../src/curriculum/story-bank';
import { Y2_STORIES } from '../../src/curriculum/stories-y2';
import { seededRng } from '../../src/game/duel';

const topic = TOPICS.find(t => t.id === 'y2-storytime')!;
const D: Difficulty[] = [1, 2, 3];

describe('y2-storytime (#1019)', () => {
  it('is registered once on the Year 2 writing tab, solo, at its head', () => {
    expect(TOPICS.filter(t => t.id === 'y2-storytime')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year2', subject: 'writing', solo: true, title: 'Story Time' });
    const ids = TOPICS.map(t => t.id);
    expect(ids.indexOf('y2-storytime')).toBe(ids.indexOf('y2-spelling') - 1);
  });

  it('never reaches a mixed mode or the duel, and is still a mission (#1017 solo rule)', () => {
    expect(mixable(topic)).toBe(false);
    expect(subjectPool(TOPICS, 'writing').map(t => t.id)).not.toContain('y2-storytime');
    expect(duelPool(TOPICS.filter(t => t.year === 'year2'), 1).map(t => t.id)).not.toContain('y2-storytime');
  });

  it('the bank breaks none of the story rules, and has ten stories', () => {
    expect(storyBankProblems(Y2_STORIES)).toEqual([]);
    expect(new Set(Y2_STORIES.map(i => i.story)).size).toBe(10);
    for (const i of Y2_STORIES) expect(i.story.split(/[.!?]+(?:\s|$)/).filter(x => x.trim()).length, i.story).toBeLessThanOrEqual(3);
  });

  it.each(D)('d%i has at least six questions, so repeat avoidance has room', d => {
    expect(Y2_STORIES.filter(i => i.d === d).length).toBeGreaterThanOrEqual(6);
  });

  it('d1 and d2 are literal and d3 is the inference', () => {
    for (const i of Y2_STORIES) expect(i.kind, i.question).toBe(i.d === 3 ? 'inference' : 'literal');
  });

  it('options are single words of at most eight letters, so they fit a bubble (#348)', () => {
    for (const i of Y2_STORIES) for (const w of [i.answer, ...i.decoys]) expect(w, `${i.question}: ${w}`).toMatch(/^[A-Za-z]{2,8}$/);
  });

  it('no question asks what happens next (#666: no single right answer)', () => {
    for (const i of Y2_STORIES) expect(i.question, i.question).not.toMatch(/\b(next|will|going to)\b/i);
  });

  it('every question is the one asked, spoken after its story, with the answer among the options', () => {
    const rng = seededRng(1019);
    for (const d of D) for (let n = 0; n < 150; n++) {
      const q = topic.gen(d, rng);
      const item = Y2_STORIES.find(i => i.question === q.prompt && i.story === q.story)!;
      expect(item, q.prompt).toBeDefined();
      expect(item.d).toBe(d);
      expect(q.say).toBe(`${item.story} ${item.question}`);
      expect(q.visual).toBeUndefined();
      expect(q.hint).toBeUndefined();
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
