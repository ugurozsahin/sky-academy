// #2318 (y6-hyphen, y6-lists): the why gives the rule or both meanings, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { RE_PAIRS, reWhy, vowelWhy } from '../../src/curriculum/year6-hyphen';
import { COLON_WHY, SEMI_WHY, bulletWhy } from '../../src/curriculum/year6-lists';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-hyphen says why (#2318)', () => {
  it('words each kind', () => {
    expect(reWhy(RE_PAIRS[4])).toBe('"resort" means a holiday place; "re-sort" means sort again.');
    expect(vowelWhy(['re', 'enter'])).toBe('A vowel meets a vowel in "reenter", so it takes a hyphen: re-enter.');
  });
  it('every draw has a why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y6-hyphen', d)) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); }
  });
  it('d3 names the meaning', () => { for (const q of draws('y6-hyphen', 3)) expect(q.why).toMatch(/hyphen/); });
});

describe('y6-lists says why (#2318)', () => {
  it('words the rules', () => {
    expect(COLON_WHY).toContain('colon');
    expect(SEMI_WHY).toContain('semicolons');
    expect(bulletWhy(true)).toBe('The other two start with a capital and end with a full stop.');
    expect(bulletWhy(false)).toBe('The other two start in lower case and have no full stop.');
  });
  it('d3: the why describes the two bullets that match', () => {
    for (const q of draws('y6-lists', 3)) {
      const rest = q.options.filter(o => o !== q.answer).map(o => o.replace(/^• /, ''));
      const cap = /^[A-Z]/.test(rest[0]);
      expect(rest.every(o => /^[A-Z]/.test(o) === cap && o.endsWith('.') === cap)).toBe(true);
      expect(q.why).toBe(bulletWhy(cap));
    }
  });
});
