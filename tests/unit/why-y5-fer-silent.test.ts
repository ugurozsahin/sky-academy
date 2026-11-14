// #2318 (y5-fer, y5-silent): the why gives the stress reason for the r count, and names the silent letter in its word.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { FER_BANK, ferWhy, ferWord } from '../../src/curriculum/year5-fer';
import { SILENT_BANK, silentWhy } from '../../src/curriculum/year5-silent';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-fer says why (#2318)', () => {
  it('words the three cases', () => {
    expect(ferWhy(['prefer', 'ed', true, ''])).toBe('The stress stays on "fer", so the r doubles: preferred.');
    expect(ferWhy(['refer', 'ence', false, ''])).toBe('The stress moves off "fer", so one r stays: reference.');
    expect(ferWhy(['offer', 'ing', false, ''])).toBe('"offer" is never stressed on -fer, so one r: offering.');
  });
  it('names the whole right word for every bank row', () => {
    for (const row of FER_BANK) expect(ferWhy(row)).toContain(ferWord(row) + '.');
  });
  it('sets a short why on every question', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-fer', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});

describe('y5-silent says why (#2318)', () => {
  it('names the word and its silent letter', () => {
    expect(silentWhy(['doubt', 3, '', ['p', 'g']])).toBe('In "doubt" the b is written but not said.');
    for (const row of SILENT_BANK) expect(silentWhy(row)).toContain(`the ${row[0][row[1]]} is`);
  });
  it('sets a short why on every question at every difficulty', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws('y5-silent', d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
