import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { duelPool } from '../../src/game/duel';
import { mixable, subjectPool } from '../../src/game/pools';
import { storyBankProblems } from '../../src/curriculum/story-bank';
import { R_STORIES } from '../../src/curriculum/stories-r';
import { seededRng } from '../../src/game/duel';

const topic = TOPICS.find(t => t.id === 'r-storytime')!;
const D: Difficulty[] = [1, 2, 3];
const EMOJI = /^\p{Extended_Pictographic}️?$/u;
const sentences = (s: string) => s.split(/[.!?]+(?:\s|$)/).filter(x => x.trim()).length;

describe('r-storytime (#1020)', () => {
  it('is registered once on the Reception writing tab, solo, after Sound Hunt', () => {
    expect(TOPICS.filter(t => t.id === 'r-storytime')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'reception', subject: 'writing', solo: true, title: 'Story Time' });
    const ids = TOPICS.map(t => t.id);
    expect(ids.indexOf('r-storytime')).toBe(ids.indexOf('r-soundhunt') + 1);
  });

  it('the bank breaks none of the story rules; ten stories of at most two sentences, two questions each', () => {
    expect(storyBankProblems(R_STORIES)).toEqual([]);
    const stories = [...new Set(R_STORIES.map(i => i.story))];
    expect(stories).toHaveLength(10);
    for (const s of stories) {
      expect(sentences(s), s).toBeLessThanOrEqual(2);
      expect(R_STORIES.filter(i => i.story === s), s).toHaveLength(2);
    }
  });

  it.each(D)('d%i has at least six questions, so repeat avoidance has room', d => {
    expect(R_STORIES.filter(i => i.d === d).length).toBeGreaterThanOrEqual(6);
  });

  it('every question is literal, and every picture answer names its word in the story', () => {
    for (const i of R_STORIES) {
      expect(i.kind, i.question).toBe('literal');
      expect(i.word, `${i.question}: a picture answer needs the word it stands for`).toBeTruthy();
      expect(i.story.toLowerCase(), i.question).toContain(i.word!.toLowerCase());
    }
  });

  it('options are one emoji each, or the digits 1-5 on a "how many" question, and are distinct', () => {
    for (const i of R_STORIES) {
      const many = /^How many/.test(i.question), all = [i.answer, ...i.decoys];
      for (const o of all) expect(many ? /^[1-5]$/.test(o) : EMOJI.test(o), `${i.question}: ${o}`).toBe(true);
      expect(new Set(all).size, i.question).toBe(all.length);
      expect(all.length, `${i.question}: three bubbles`).toBe(3);
    }
  });

  it('"how many" is asked only at d3, and the number is the one the story says', () => {
    const NUM = ['', 'one', 'two', 'three', 'four', 'five'];
    for (const i of R_STORIES.filter(x => /^How many/.test(x.question))) {
      expect(i.d, i.question).toBe(3);
      expect(i.word, i.question).toBe(NUM[Number(i.answer)]);
    }
    for (const i of R_STORIES.filter(x => x.d === 3)) expect(i.question, 'd3 is the counting rung').toMatch(/^How many/);
  });

  it('no question asks what happens next (#666: no single right answer)', () => {
    for (const i of R_STORIES) expect(i.question, i.question).not.toMatch(/\b(next|will|going to)\b/i);
  });

  it('never reaches a mixed mode, a subject pool or the duel', () => {
    expect(mixable(topic)).toBe(false);
    expect(subjectPool(TOPICS, 'writing').map(t => t.id)).not.toContain('r-storytime');
    expect(duelPool(TOPICS.filter(t => t.year === 'reception'), 1).map(t => t.id)).not.toContain('r-storytime');
  });

  it('every question is the one asked, spoken after its story, with the answer among the options', () => {
    const rng = seededRng(1020);
    for (const d of D) for (let n = 0; n < 150; n++) {
      const q = topic.gen(d, rng);
      const item = R_STORIES.find(i => i.question === q.prompt && i.story === q.story)!;
      expect(item, q.prompt).toBeDefined();
      expect(item.d).toBe(d);
      expect(q.say).toBe(`${item.story} ${item.question}`);
      expect(q.visual).toBeUndefined();
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
