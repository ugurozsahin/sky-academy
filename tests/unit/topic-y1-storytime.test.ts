import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';
import { mixable, subjectPool } from '../../src/game/pools';
import { storyBankProblems } from '../../src/curriculum/story-bank';
import { Y1_STORIES } from '../../src/curriculum/stories-y1';
import { seededRng } from '../../src/game/duel';

const topic = TOPICS.find(t => t.id === 'y1-storytime')!;
const D: Difficulty[] = [1, 2, 3];

describe('y1-storytime (#1018)', () => {
  it('is registered once on the Year 1 writing tab, solo, after Sound Hunt', () => {
    expect(TOPICS.filter(t => t.id === 'y1-storytime')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year1', subject: 'writing', solo: true, title: 'Story Time' });
    const ids = TOPICS.map(t => t.id);
    expect(ids.indexOf('y1-storytime')).toBe(ids.indexOf('y1-soundhunt') + 1);
  });

  it('never reaches a mixed mode or the duel, and is still a mission (#1017 solo rule)', () => {
    expect(mixable(topic)).toBe(false);
    expect(subjectPool(TOPICS, 'writing').map(t => t.id)).not.toContain('y1-storytime');
    expect(duelPool(TOPICS.filter(t => t.year === 'year1'), 1).map(t => t.id)).not.toContain('y1-storytime');
  });

  it('the bank breaks none of the story rules, and has ten stories', () => {
    expect(storyBankProblems(Y1_STORIES)).toEqual([]);
    expect(new Set(Y1_STORIES.map(i => i.story)).size).toBe(10);
    for (const i of Y1_STORIES) expect(i.story.split(/[.!?]+(?:\s|$)/).filter(x => x.trim()).length, i.story).toBeLessThanOrEqual(3);
  });

  it.each(D)('d%i has at least six questions, so repeat avoidance has room', d => {
    expect(Y1_STORIES.filter(i => i.d === d).length).toBeGreaterThanOrEqual(6);
  });

  it('d1 and d2 are literal and d3 is the inference', () => {
    for (const i of Y1_STORIES) expect(i.kind, i.question).toBe(i.d === 3 ? 'inference' : 'literal');
  });

  it('options are single words of at most eight letters, so they fit a bubble (#348)', () => {
    for (const i of Y1_STORIES) for (const w of [i.answer, ...i.decoys]) expect(w, `${i.question}: ${w}`).toMatch(/^[A-Za-z]{2,8}$/);
  });

  it('no question asks what happens next (#666: no single right answer)', () => {
    for (const i of Y1_STORIES) expect(i.question, i.question).not.toMatch(/\b(next|will|going to)\b/i);
  });

  it('every question is the one asked, spoken after its story, with the answer among the options', () => {
    const rng = seededRng(1018);
    for (const d of D) for (let n = 0; n < 150; n++) {
      const q = topic.gen(d, rng);
      const item = Y1_STORIES.find(i => i.question === q.prompt && i.story === q.story)!;
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
