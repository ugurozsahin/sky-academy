// #2318 (y2-spelling): every draw says which letter of the word is the tricky one.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { TRICKY } from '../../src/curriculum/tricky-gaps';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y2-spelling')!.gen;

describe('y2-spelling says why (#2318)', () => {
  it('every draw names the word and its tricky letter, short and not the bare answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
      const w = Object.keys(TRICKY).find(k => q.why!.startsWith(`${k}: `))!;
      expect(w, q.why).toBeTruthy();
      expect(q.why).toBe(`${w}: the tricky letter is "${w[TRICKY[w][0]]}".`);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
