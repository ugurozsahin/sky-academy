// #2318 (y5-ant): the why names the related word that gives the vowel away, or says the word has to be learnt.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { antWhy, ANT_BANK } from '../../src/curriculum/year5-ant';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y5-ant')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-ant says why (#2318)', () => {
  it('words the clue and the learnt words', () => {
    expect(antWhy(['hesit', 'ant', 'ent', 'hesitation', ''])).toBe('The related word "hesitation" has a clear a, so it is hesitant.');
    expect(antWhy(['presid', 'ent', 'ant', 'presidential', ''])).toBe('The related word "presidential" has a clear e, so it is president.');
    expect(antWhy(['flu', 'ency', 'ancy', null, ''])).toBe('Nothing to hear, so it has to be learnt: fluency.');
  });
  it('gives every bank row a why that names its whole word', () => {
    for (const row of ANT_BANK) expect(antWhy(row)).toContain(`${row[0]}${row[1]}.`);
  });
  it('names a vowel that matches the ending, and says "learnt" only where there is no clue', () => {
    for (const row of ANT_BANK) {
      const why = antWhy(row);
      if (row[3]) expect(why).toContain(`has a clear ${row[1][0]},`);
      else expect(why).toContain('has to be learnt');
      expect(why.includes('learnt')).toBe(!row[3]);
    }
    expect(ANT_BANK.find(r => r[0] === 'hesit' && r[1] === 'ancy')![3]).toBe('hesitation');
    expect(ANT_BANK.find(r => r[0] === 'vac')![3]).toBe('vacate');
  });
  it('sets a short why on every question, never the bare ending', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).toContain(`${q.answer}`);
    }
  });
});
