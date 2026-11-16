// #2318 (y1-digraphs): every missing pair has a short why that names the rule, never just the letters.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { DIGRAPH_WHY, DIGRAPH_WORDS } from '../../src/curriculum/year1';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y1-digraphs')!.gen;

describe('y1-digraphs says why (#2318)', () => {
  it('every digraph in the bank has a why of 14 words or fewer that is not the bare answer', () => {
    for (const dg of new Set(DIGRAPH_WORDS.map(r => r[1]))) {
      const why = DIGRAPH_WHY[dg];
      expect(why, dg).toBeTruthy();
      expect(why.split(/\s+/).length, why).toBeLessThanOrEqual(14);
      expect(why, dg).not.toBe(dg);
    }
  });
  it('every draw carries the why for its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).toBe(DIGRAPH_WHY[q.answer]);
    }
  });
});
