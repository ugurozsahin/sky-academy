// #2318 (y5-cious): the why gives the root or the vowel/consonant rule, never the bare ending.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { ciousWhy } from '../../src/curriculum/year5-cious';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y5-cious')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-cious says why (#2318)', () => {
  it('words the root, the rule and the exception', () => {
    expect(ciousWhy('vi', 'cious', 'vice')).toBe('The root is "vice", so it is vicious.');
    expect(ciousWhy('spe', 'cial')).toBe('After a vowel letter, the ending is -cial.');
    expect(ciousWhy('par', 'tial')).toBe('After a consonant letter, the ending is -tial.');
    expect(ciousWhy('finan', 'cial')).toBe('financial is an exception: learn the whole word.');
    expect(ciousWhy('ini', 'tial')).toBe('initial is an exception: learn the whole word.');
  });
  it('sets a short why on every question, never the bare ending', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
