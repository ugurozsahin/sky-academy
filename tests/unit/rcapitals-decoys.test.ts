import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { R_LETTERS_ALL, R_LETTERS_P2, R_LOOKALIKE } from '../../src/curriculum/reception';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gen = TOPICS.find(x => x.id === 'r-capitals')!.gen;
const N = 250;

describe('#2320 r-capitals: a look-alike letter is among the wrong answers', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over ${N} seeds the answer is unique and a look-alike in the pool is always offered`, () => {
      const pool = d === 1 ? R_LETTERS_P2 : R_LETTERS_ALL;
      const r = rng(2400 + d);
      let withTwin = 0;
      for (let i = 0; i < N; i++) {
        const q = gen(d, r);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
        const l = q.answer.toLowerCase();
        const twins = (R_LOOKALIKE[l] ?? []).filter(x => pool.includes(x));
        if (!twins.length) continue;
        withTwin++;
        const lowers = q.options.map(o => o.toLowerCase());
        expect(twins.some(t => lowers.includes(t)), `${l} offered ${lowers}`).toBe(true);
      }
      expect(withTwin).toBeGreaterThan(20);
    });
  }
});
