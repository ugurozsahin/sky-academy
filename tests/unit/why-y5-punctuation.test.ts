// #2318 (y5-parenthesis, y5-commas): the why gives the job of the marks, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { insideWhy, missingWhy, pairWhy } from '../../src/curriculum/year5-parenthesis';
import { addressWhy, whileWhy } from '../../src/curriculum/year5-commas';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));
const words = (s: string) => s.split(/\s+/).length;

describe('year 5 punctuation topics say why (#2318)', () => {
  it('words the job of each card', () => {
    expect(pairWhy('dash', 'a spaniel')).toBe('"a spaniel" is extra, so dashes go round it as a pair.');
    expect(missingWhy('open', 'Ginger')).toBe('Brackets come in a pair: one before "Ginger".');
    expect(missingWhy('close', 'Ginger')).toBe('Brackets come in a pair: one after "Ginger".');
    expect(insideWhy('Ginger')).toBe('"Ginger" sits between the pair, so it is part of the parenthesis.');
    expect(addressWhy('eat', 'Grandma')).toBe('The comma goes after "eat", so Grandma is who we are talking to.');
    expect(whileWhy('reading')).toBe('The comma goes after "reading", where the opening part ends and you pause.');
  });
  it('sets a short why on every question, tied to its own sentence', () => {
    for (const id of ['y5-parenthesis', 'y5-commas'] as const) for (const d of [1, 2, 3] as const) for (const q of draws(id, d)) {
      expect(q.why, id).toBeTruthy();
      expect(words(q.why!)).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
    for (const q of draws('y5-commas', 1)) expect(q.why).toContain(`"${q.answer}"`);
    for (const q of draws('y5-commas', 2)) expect(q.why).toContain(`"${q.answer}"`);
    for (const q of draws('y5-parenthesis', 3)) expect(q.why).toContain(`"${q.answer}"`);
  });
});
