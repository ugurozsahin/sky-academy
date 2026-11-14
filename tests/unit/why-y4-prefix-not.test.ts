// #2318 (y4-prefix-not): the why gives the spelling rule for the prefix, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { prefixWhy, PREFIX_NOT_ROOTS } from '../../src/curriculum/year4-prefix-not';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-prefix-not')!.gen(d, rngOf((n + 1) * 104729 + d))));

describe('y4-prefix-not says why (#2318)', () => {
  it('states the rule for each prefix', () => {
    expect(prefixWhy('il', 'legal')).toBe('il- goes before l.');
    expect(prefixWhy('im', 'polite')).toBe('im- goes before m or p.');
    expect(prefixWhy('ir', 'regular')).toBe('ir- goes before r.');
    expect(prefixWhy('in', 'active')).toBe('in- goes before a.');
  });
  it('every root has a why', () => { for (const [r, p] of PREFIX_NOT_ROOTS) expect(prefixWhy(p, r)).not.toMatch(/undefined/); });
  it('every question has a short why that is not the answer', () => {
    for (const q of draws) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      expect(q.why).not.toMatch(/undefined/);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
