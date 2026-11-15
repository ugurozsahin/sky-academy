// #2318 (y6-synonyms): the why names the relation between the headword and the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { SYN_ANT, synWhy } from '../../src/curriculum/year6-synonyms';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-synonyms')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-synonyms says why (#2318)', () => {
  it('words each relation', () => {
    expect(synWhy('big', 'large', true)).toBe('Large means the same as big.');
    expect(synWhy('big', 'little', false)).toBe('Little is the opposite of big.');
  });
  it('every draw has a short why that names its answer and is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer);
      expect(q.why!.toLowerCase()).toContain(q.answer.toLowerCase());
      expect(q.why).toMatch(d === 1 ? /means the same/ : d === 2 ? /opposite/ : /means the same|opposite/);
    }
  });
  it('the why agrees with the bank row', () => {
    for (const q of draws(3)) {
      const row = SYN_ANT.find(r => q.why!.endsWith(` ${r[0]}.`))!;
      expect(q.why!.startsWith(q.why!.includes('opposite') ? row[2][0].toUpperCase() + row[2].slice(1) : row[1][0].toUpperCase() + row[1].slice(1))).toBe(true);
    }
  });
});
