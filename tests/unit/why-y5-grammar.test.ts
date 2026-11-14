// #2318 (y5-relative, y5-modal): the why gives the job or the test for the word, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { fitWhy, omitWhy, spotWhy } from '../../src/curriculum/year5-relative';
import { adverbWhy, modalWhy, sureWhy } from '../../src/curriculum/year5-modal';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('year 5 grammar topics say why (#2318)', () => {
  it('words the job of each family', () => {
    expect(spotWhy('who')).toBe('"who" is the relative pronoun: it points to a person.');
    expect(fitWhy('whose')).toBe('"whose" fits: it points to who owns something.');
    expect(fitWhy('which')).toBe('"which" fits: it points to a thing, after a comma.');
    expect(omitWhy('film')).toBe('The missing pronoun goes after "film", the noun it tells us about.');
    expect(modalWhy('might', 'go')).toBe('"might" comes before "go", so it is a modal verb.');
    expect(adverbWhy('perhaps')).toBe('"perhaps" says how likely it is: an adverb of possibility.');
    expect(sureWhy('will', true)).toBe('"will" says it is sure to happen: certain.');
    expect(sureWhy('maybe', false)).toBe('"maybe" only says it could happen: possible.');
  });
  it('ties each why to its own question', () => {
    for (const q of draws('y5-relative', 1)) expect(q.why).toContain(`"${q.answer}"`);
    for (const q of draws('y5-relative', 2)) expect(q.why).toContain(`"${q.answer}"`);
    for (const q of draws('y5-relative', 3)) expect(q.why).toContain(`"${q.answer}"`);
    for (const q of draws('y5-modal', 1)) {
      const text = q.visual && 'text' in q.visual ? q.visual.text : '';
      const [, w, n] = q.why!.match(/^"(\w+)" comes before "(\w+)"/)!;
      expect(w).toBe(q.answer.toLowerCase());
      expect(text.toLowerCase()).toContain(`${w} ${n}`);
    }
    for (const q of draws('y5-modal', 2)) expect(q.why).toContain(`"${q.answer.toLowerCase()}"`);
    for (const q of draws('y5-modal', 3)) expect(q.why).toMatch(q.answer === 'certain' ? /sure to happen/ : /could happen/);
  });
});
