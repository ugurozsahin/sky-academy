// #2318 (y6-ough, y6-homophones): the why names the sound, the rule or the meaning, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { EI_C, OUGH, eiWhy, oughWhy, rhymeWhy } from '../../src/curriculum/year6-ough';
import { Y6_HOMOPHONES, Y6_HOM_MEANING, y6HomWhy } from '../../src/curriculum/year6-homophones';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-ough says why (#2318)', () => {
  it('words each kind', () => {
    expect(oughWhy(OUGH[0])).toBe('"ough" can say "or", as in ought.');
    expect(eiWhy(EI_C[0])).toBe('After c it is ei, not ie: deceive.');
    expect(eiWhy(EI_C.find(r => r[3])!)).toBe('Not "i before e" here: learn protein.');
    expect(rhymeWhy('bought', 'ought', 'ought')).toBe('"ough" says "or" in both bought and ought.');
  });
});

describe('y6-homophones says why (#2318)', () => {
  it('names the meaning, and a missing word throws', () => {
    expect(y6HomWhy('isle')).toBe('Isle is an island.');
    expect(() => y6HomWhy('nonsense')).toThrow();
  });
  it('every bank answer has a meaning', () => {
    expect(Y6_HOMOPHONES.every(r => r[1] in Y6_HOM_MEANING && r[2] in Y6_HOM_MEANING)).toBe(true);
  });
});

describe.each(['y6-ough', 'y6-homophones'])('%s sets a short why on every question', id => {
  it('is short and is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(id, d)) {
      expect(q.why).toBeTruthy();
      expect(q.why).not.toBe(q.answer);
      if (id === 'y6-ough' && q.why!.includes('i before e')) expect(['protein', 'caffeine', 'seize']).toContain(q.answer);
      if (id === 'y6-ough' && q.why!.includes('both')) expect(q.why).toMatch(/^"ough" says "(or|uff|oh|ow)" in both \w+ and \w+\.$/);
      expect(q.why).not.toMatch(/undefined/);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
