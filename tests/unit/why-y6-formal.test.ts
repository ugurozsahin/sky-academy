// #2318 (y6-formal): the why says what makes the informal wording chatty and names the formal one, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { FORMAL_WORDS, REGISTER_PAIRS, formalWordWhy, registerWhy } from '../../src/curriculum/year6-formal';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y6-formal')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y6-formal says why (#2318)', () => {
  it('words the d1/d2 why', () => {
    expect(formalWordWhy(FORMAL_WORDS[0])).toBe('"find out" is chatty. "discover" is the formal word.');
  });
  it('every draw has a short why that is not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
  it('d3 names a true reason for every pair', () => {
    for (const [f, i] of REGISTER_PAIRS) {
      const w = registerWhy(f, i);
      if (w.includes('question tag')) expect(i).toMatch(/\?$/);
      else if (w.includes('Short forms')) expect(i).toMatch(/[a-z]'[a-z]/i);
      else { expect(w).toMatch(/^"[^"]+" is chatty\. A formal letter says "[^"]+"\.$/); const [, a, b] = w.match(/"([^"]+)".*"([^"]+)"/)!; expect(i.toLowerCase()).toContain(a); expect(f.toLowerCase()).toContain(b); }
    }
  });
});
