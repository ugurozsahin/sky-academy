// #2317 (y1-months, y1-when, y3-calendar): the why line states a fact that is true of the card it follows.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d))));
const words = (w: string) => w.split(/\s+/).length;

describe('time topics say why (#2317)', () => {
  it('every card sets a why within the length limit', () => {
    for (const [id, max] of [['y1-months', 8], ['y1-when', 8], ['y3-calendar', 14]] as const)
      for (const q of all(id)) { expect(q.why, `${id} ${q.prompt}`).toBeTruthy(); expect(words(q.why!), q.why).toBeLessThanOrEqual(max); }
  });
  it('y1-months: an order why repeats the card and the answer', () => {
    for (const q of all('y1-months').filter(q => /comes (after|before)/.test(q.prompt))) {
      const m = q.prompt.match(/comes (after|before) (\w+)\?/)!;
      expect(q.why).toBe(`${q.answer} comes ${m[1]} ${m[2]}.`);
    }
  });
  it('y3-calendar: a duration why states the minutes the answer is', () => {
    for (const q of all('y3-calendar').filter(q => q.prompt.includes('How many minutes'))) expect(q.why).toContain(` is ${q.answer} minutes.`);
  });
  it('y3-calendar: a seconds why states the answer', () => {
    for (const q of all('y3-calendar').filter(q => /seconds in .*minutes\?/.test(q.prompt))) expect(q.why).toContain(`is ${q.answer} seconds.`);
  });
});
