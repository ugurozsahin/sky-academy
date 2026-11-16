// #2318 (y1-alphabet): every draw says which letter sits next to the shown one in the alphabet.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y1-alphabet')!.gen;

describe('y1-alphabet says why (#2318)', () => {
  it('every draw names its letters, is short and is not the bare answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 7919 + d));
            expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(q.why).not.toBe(q.answer);
      if (q.sequence) expect(q.why).toContain(q.sequence.join(', '));
      else expect(q.why).toMatch(new RegExp(`^${q.answer} comes ${q.prompt.includes('after') ? 'after' : 'before'} .* in the alphabet\\.$`));
    }
  });
});
