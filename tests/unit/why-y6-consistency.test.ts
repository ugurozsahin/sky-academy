// #2318 (y6-consistency): the why names the subject and its number, or the tense the time words set.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { AGREE_PLAIN, AGREE_TRAP, TENSE_LATE, TENSE_PLAIN, agreeWhy, tenseWhy } from '../../src/curriculum/year6-consistency';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-consistency')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-consistency says why (#2318)', () => {
  it('words each case', () => {
    expect(agreeWhy('The dogs _ hungry.', 'are')).toBe('The subject is dogs: more than one, so are.');
    expect(agreeWhy('The girls _ new coats.', 'have')).toBe('The subject is girls: more than one, so have.');
    expect(agreeWhy('The box of pencils _ on the desk.', 'is')).toBe('The subject is box, not pencils: one, so is.');
    expect(agreeWhy('Each of the pupils _ a book.', 'has')).toBe('The subject is each, not pupils: one, so has.');
    expect(tenseWhy('will visit', 'future')).toMatch(/looks ahead/);
    expect(tenseWhy('washed', 'past')).toMatch(/about the past/);
    expect(tenseWhy('cooks', 'present')).toMatch(/Nowadays means now/);
  });
  it('agreeWhy throws when the subject cannot be derived', () => {
    expect(() => agreeWhy('_ tired.', 'is')).toThrow();
    expect(() => agreeWhy('Mum _ tired.', 'is')).toThrow();
    expect(() => agreeWhy('The dogs _ hungry.', 'were')).toThrow();
  });
  it('every agreement row names its own subject and number', () => {
    for (const [sentence, answer] of [...AGREE_PLAIN, ...AGREE_TRAP]) {
      const w = sentence.split(' '), subject = (w[0] === 'Each' ? w[0] : w[1]).toLowerCase();
      const why = agreeWhy(sentence, answer);
      expect(why, sentence).toContain(`The subject is ${subject}`);
      expect(why, sentence).toContain(['is', 'has'].includes(answer) ? ': one,' : ': more than one,');
      expect(why.endsWith(`so ${answer}.`), sentence).toBe(true);
    }
  });
  it('every tense row carries a tense that matches its answer and clue', () => {
    for (const [sentence, answer, others, tense] of [...TENSE_PLAIN, ...TENSE_LATE]) {
      expect(tense === 'future', sentence).toBe(answer.startsWith('will '));
      if (tense === 'present') expect(sentence, sentence).toMatch(/^Nowadays/);
      if (tense === 'past') expect(sentence, sentence).toMatch(/Yesterday|Last|ago/);
      expect(others, sentence).not.toContain(answer);
      expect(tenseWhy(answer, tense), sentence).toContain(answer);
    }
  });
  it('every draw has a short why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.endsWith(`${q.answer}.`), q.why).toBe(true);
    }
  });
});
