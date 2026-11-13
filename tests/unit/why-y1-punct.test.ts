// #2318 (y1-punct): the why gives the capital-letter or end-mark rule, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { END_MARK_WHY } from '../../src/curriculum/year1-punct';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y1-punct says why (#2318)', () => {
  it('gives each card form its rule', () => {
    const seen = { names: 0, first: 0, mark: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = TOPICS.find(x => x.id === 'y1-punct')!.gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).not.toBe(q.answer);
      if (q.prompt === 'Which word needs a capital letter?') { seen.names++; expect(q.why).toBe('Names, days and I need a capital.'); }
      else if (q.answer in END_MARK_WHY) { seen.mark++; expect(q.why).toBe(END_MARK_WHY[q.answer]); }
      else { seen.first++; expect(q.why).toBe(`A sentence starts with a capital: ${q.answer}.`); }
    }
    expect(seen.names).toBeGreaterThan(0); expect(seen.first).toBeGreaterThan(0); expect(seen.mark).toBeGreaterThan(0);
  });
});
