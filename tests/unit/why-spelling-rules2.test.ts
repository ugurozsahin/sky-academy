// #2318 (y2-spell-dge, y2-spell-c, y2-spell-le, y2-spell-tion): the why states the rule the card tests.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d))));

describe('more spelling-rule topics say why (#2318)', () => {
  it('y2-spell-dge: the why matches the ending the answer has', () => {
    for (const q of all('y2-spell-dge')) {
      if (q.answer.endsWith('dge')) expect(q.why).toBe('-dge comes after a short vowel.');
      else if (q.answer.endsWith('ge')) expect(q.why).toBe('We never end a word in j: -ge.');
      else expect(q.why).toBe('g can say j before e, i, y.');
    }
  });
  it('y2-spell-c: the why names the letter after the c', () => {
    for (const q of all('y2-spell-c')) expect(q.why).toBe(`c says s before ${q.answer[q.answer.indexOf('c') + 1]}.`);
  });
  it('y2-spell-le: the why names the ending of the answer', () => {
    for (const q of all('y2-spell-le')) expect(q.why).toBe(q.answer.endsWith('le') ? `${q.answer} ends -le, the usual ending.` : `${q.answer} ends -${q.answer.slice(-2)}.`);
  });
  it('y2-spell-tion: the why names the shun ending', () => {
    for (const q of all('y2-spell-tion')) expect(q.why).toBe(`${q.answer}: the shun sound is -tion.`);
  });
});
