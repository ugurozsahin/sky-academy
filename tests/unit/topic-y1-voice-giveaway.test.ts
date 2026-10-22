import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// #2274: the voice must not say the answer the card asks the child to find.
const draw = (id: string, d: Difficulty, seed: number) => TOPICS.find(t => t.id === id)!.gen(d, rng(seed));

describe('y1 voice does not give the answer away (#2274)', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`y1-plurals never says the plural, difficulty ${d}`, () => {
      for (let s = 0; s < 200; s++) {
        const q = draw('y1-plurals', d, s), say = (q.say ?? '').toLowerCase();
        const stem = q.prompt.match(/two (\w+?)_/)![1];
        expect(say, q.prompt).not.toMatch(new RegExp(`${stem}${q.answer}`));
        expect(say).toContain(`one ${stem}`);
      }
    });
    it(`y1-words never reads the number word, difficulty ${d}`, () => {
      for (let s = 0; s < 200; s++) {
        const q = draw('y1-words', d, s);
        if (q.visual?.type !== 'word') continue;
        expect(q.say).toBe('Which number is this word?');
        expect(q.say).not.toContain(q.visual.text);
      }
    });
  }
});
