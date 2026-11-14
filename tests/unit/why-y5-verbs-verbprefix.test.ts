// #2318 (y5-verbs, y5-verbprefix): the why names the root's ending change, and the prefix with its meaning.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { VERB_BANK, verbOf, verbWhy } from '../../src/curriculum/year5-verbs';
import { VERBPREFIX_BANK, vpVerb, vpWhy } from '../../src/curriculum/year5-verbprefix';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-verbs says why (#2318)', () => {
  it('words both cases', () => {
    expect(verbWhy(['real', 'real', 'ise', ''])).toBe('"real" keeps every letter, then -ise: realise.');
    expect(verbWhy(['pure', 'pur', 'ify', ''])).toBe('"pure" loses its last letters, so pur + ify: purify.');
  });
  it('names the whole verb for every bank row', () => {
    for (const row of VERB_BANK) expect(verbWhy(row)).toContain(verbOf(row) + '.');
  });
  it('sets a short why on every question', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-verbs', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});

describe('y5-verbprefix says why (#2318)', () => {
  it('gives the prefix, the meaning and the verb', () => {
    expect(vpWhy(VERBPREFIX_BANK.find(r => r[0] === 'sleep')!)).toBe('over- + sleep means "sleep for too long": oversleep.');
    for (const row of VERBPREFIX_BANK) expect(vpWhy(row)).toContain(vpVerb(row) + '.');
  });
  it('sets a short why on every question', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-verbprefix', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
