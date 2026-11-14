// #2318 (y4-ous, y4-shun, y4-sure-ture): the why names the rule applied to the word, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { OUS_BANK, ousWhy } from '../../src/curriculum/year4-ous';
import { shunWhy } from '../../src/curriculum/year4-shun';
import { sureWhy } from '../../src/curriculum/year4-sure-ture';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('year 4 suffix topics say why (#2318)', () => {
  it('words the rule for each family', () => {
    expect(ousWhy('humorous', 'our-or')).toBe('Humorous: -our becomes -or before -ous.');
    expect(ousWhy('hideous', 'i-e')).toBe('Hideous has e before -ous.');
    expect(ousWhy('serious', 'i-e')).toBe('Serious has i before -ous.');
    expect(shunWhy('invent', 'invention', 'tion')).toBe('Invent becomes invention: it takes -tion.');
    expect(shunWhy('attend', 'attention', 'tion')).toBe('Attend ends in d, but attention still takes -tion.');
    expect(sureWhy('mea', 'sure')).toBe('Measure ends -sure, which sounds like "zhur".');
    expect(sureWhy('tea', 'cher')).toBe('Teacher is teach plus er, so -cher.');
  });
  it('pins the exact why for every -ous row, so a wrong rule cannot slip past the length check', () => {
    const want: Record<string, string> = {
      poisonous: 'Poison + ous: just add -ous.', dangerous: 'Danger + ous: just add -ous.', famous: 'Fame loses its e: famous.',
      nervous: 'Nerve loses its e: nervous.', joyous: 'Joy + ous: just add -ous.', enormous: 'Enormous has no root word: it just ends -ous.',
      jealous: 'Jealous has no root word: it just ends -ous.', generous: 'Generous has no root word: it just ends -ous.',
      various: 'The y in vary changes to i: various.', humorous: 'Humorous: -our becomes -or before -ous.',
      vigorous: 'Vigorous: -our becomes -or before -ous.', gorgeous: 'Gorgeous keeps its e before -ous.',
      serious: 'Serious has i before -ous.', obvious: 'Obvious has i before -ous.', curious: 'Curious has i before -ous.', hideous: 'Hideous has e before -ous.',
    };
    expect(OUS_BANK.map(r => r[0]).sort()).toEqual(Object.keys(want).sort());
    for (const [w, rule] of OUS_BANK) expect(ousWhy(w, rule)).toBe(want[w]);
  });
  for (const id of ['y4-ous', 'y4-shun', 'y4-sure-ture']) {
    it(`${id}: every question has a short why that is not the answer`, () => {
      for (const q of draws(id)) {
        expect(q.why).toBeTruthy();
        expect(q.why).not.toBe(q.answer);
        expect(q.why).not.toMatch(/undefined/);
        expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      }
    });
  }
});
