// #2318 (y3-homophones): the why says what the spelling means, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { homWhy, HOMOPHONE_BANK, HOM_MEANING } from '../../src/curriculum/year3-homophones';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y3-homophones')!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y3-homophones says why (#2318)', () => {
  it('names the meaning of the spelling', () => {
    expect(homWhy('brake')).toBe('Brake is what stops a bike.');
    expect(homWhy('Here')).toBe('Here means in this place.');
  });
  it('every bank answer has a meaning, and a missing one throws', () => {
    expect(HOMOPHONE_BANK.every(r => r[2].toLowerCase() in HOM_MEANING)).toBe(true);
    expect(() => homWhy('nonsense')).toThrow();
  });
  it('every question has a short why that is not the answer', () => {
    for (const q of draws) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      expect(q.why).not.toMatch(/undefined/);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
