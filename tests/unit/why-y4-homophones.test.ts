// #2318 (y4-homophones): the why says what the spelling means, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { hom2Why, HOMOPHONE_BANK_2, HOM2_MEANING } from '../../src/curriculum/year4-homophones';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-homophones')!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y4-homophones says why (#2318)', () => {
  it('names the meaning of the spelling', () => {
    expect(hom2Why('rein')).toBe('Rein is the strap that steers a horse.');
    expect(hom2Why('Whose')).toBe('Whose asks who owns it.');
  });
  it('every bank answer has a meaning, and a missing one throws', () => {
    expect(HOMOPHONE_BANK_2.every(r => r[2].toLowerCase() in HOM2_MEANING)).toBe(true);
    expect(() => hom2Why('nonsense')).toThrow();
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
