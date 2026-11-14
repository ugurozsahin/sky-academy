// #2318 (y4-determiners, y4-pronouns): the why gives the test for the word class or the pronoun, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { detWhy, possWhy, termWhy } from '../../src/curriculum/year4-determiners';
import { clearWhy, pronounWhy } from '../../src/curriculum/year4-pronouns';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('year 4 grammar topics say why (#2318)', () => {
  it('words the test for each family', () => {
    expect(detWhy('The')).toBe('The comes before a noun, so it is a determiner.');
    expect(possWhy('mine')).toBe('Mine stands on its own with no noun after it: a possessive pronoun.');
    expect(termWhy('Their', true)).toBe('"Their" comes before a noun, so it is a determiner.');
    expect(termWhy('theirs', false)).toBe('"theirs" stands on its own, so it is a possessive pronoun.');
    expect(pronounWhy('F', 'she', false)).toBe('The text is about a girl or woman, so the subject is "she".');
    expect(pronounWhy('P', 'them', true)).toBe('As the object, it is "them": the text is about more than one.');
    expect(clearWhy('He', 'The prince')).toBe('"He" could mean either one, so say the prince.');
  });
  it('keeps a name capitalised and lowercases only a leading The or My', () => {
    expect(clearWhy('She', 'Grandma')).toBe('"She" could mean either one, so say Grandma.');
    expect(clearWhy('He', 'My brother')).toBe('"He" could mean either one, so say my brother.');
  });
  it('ties each why to its question over the draws', () => {
    for (const q of draws('y4-determiners')) {
      if (q.prompt.includes('determiner?')) expect(q.why).toContain('determiner');
      if (q.prompt.includes('possessive pronoun?')) expect(q.why).toContain('possessive pronoun');
    }
    for (const q of draws('y4-pronouns')) {
      if (q.why!.startsWith('As the object')) expect(q.visual && 'text' in q.visual ? q.visual.text : '').toMatch(/___\.$/);
      if (q.why!.includes('could mean either one')) {
        const said = q.why!.match(/so say (.+)\.$/)![1];
        expect(said.toLowerCase()).toBe(q.answer.toLowerCase());
        expect(said.slice(1)).toBe(q.answer.slice(1));
      }
    }
  });
  for (const id of ['y4-determiners', 'y4-pronouns']) {
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
