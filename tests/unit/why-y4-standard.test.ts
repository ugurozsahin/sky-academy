// #2318 (y4-standard): the why gives the rule (subject, or the word before the gap), never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { OTHER_VERBS, WAS_WERE, standardWhy } from '../../src/curriculum/year4-standard';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-standard')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y4-standard says why (#2318)', () => {
  it('words each kind of row', () => {
    expect(standardWhy(WAS_WERE[0])).toBe('With "we", use "were", not "was".');
    expect(standardWhy(WAS_WERE[3])).toBe('With "she", use "was", not "were".');
    expect(standardWhy(OTHER_VERBS[0])).toBe('On its own, use the past: "did", not "done".');
    expect(standardWhy(OTHER_VERBS[1])).toBe('After "have", use "done", not "did".');
    expect(standardWhy(OTHER_VERBS[5])).toBe('After "has", use "come", not "came".');
  });
  it('every row: the rule, the subject with a capital I, the auxiliary in lower case', () => {
    for (const row of [...WAS_WERE, ...OTHER_VERBS]) {
      const [sentence, standard, local] = row, why = standardWhy(row);
      expect(why).toContain(`"${standard}", not "${local}"`);
      if (standard === 'was' || standard === 'were') {
        const w = sentence.split(' ')[0];
        expect(why.startsWith(`With "${w === 'I' ? 'I' : w.toLowerCase()}",`)).toBe(true);
      } else {
        const aux = /\b(has|have|had)\b/i.exec(sentence.split('___')[0]);
        expect(why.startsWith(aux ? `After "${aux[1].toLowerCase()}",` : 'On its own,')).toBe(true);
      }
    }
    expect(standardWhy(WAS_WERE[5])).toBe('With "I", use "was", not "were".');
    expect(standardWhy(OTHER_VERBS[3])).toBe('After "have", use "seen", not "saw".');
  });
  it('every draw has a short why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) { expect(q.why).toBeTruthy(); expect(q.why).toContain(`"${q.answer}"`); expect(q.why).not.toBe(q.answer); expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14); }
  });
});
