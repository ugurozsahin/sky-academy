// #2317 (y3-money family): each why is the same sum in whole pence and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { coinLabel } from '../../src/curriculum/util';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y3-money')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y3-money whys (#2317)', () => {
  it('every question at every level has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) { expect(q.why, q.prompt).toBeTruthy(); expect(q.why!.split(' ').length).toBeLessThanOrEqual(14); }
  });
  it('every why ends in the answer, and its left side is arithmetically right', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const [lhs, rhs] = q.why!.split(' = ');
      expect(coinLabel(parseInt(rhs)), q.why).toBe(q.answer);
      const terms = lhs.split(/ ([+−]) /);
      let v = parseInt(terms[0]);
      for (let i = 1; i < terms.length; i += 2) v += (terms[i] === '+' ? 1 : -1) * parseInt(terms[i + 1]);
      expect(v, q.why).toBe(parseInt(rhs));
    }
  });
});
