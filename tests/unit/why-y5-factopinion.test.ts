// #2318: y5-factopinion says why: a fact can be checked; an opinion leans on a feeling word.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { OPINION_MARKERS, wordsOf } from '../../src/curriculum/year5-factopinion';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y5-factopinion')!.gen;

describe('y5-factopinion says why (#2318)', () => {
  it('d1/d2: a fact says it can be checked; an opinion quotes a real clue word from its sentence', () => {
    for (const d of [1, 2] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const text = (q.visual as { text: string }).text;
      if (q.answer === 'fact') { expect(q.why).toBe('You could check it, so it is a fact.'); continue; }
      const m = q.why!.match(/^"(\w+)" is a feeling/)!;
      expect(OPINION_MARKERS, q.why).toContain(m[1]);
      expect(wordsOf(text), q.why).toContain(m[1]);
    }
  });
  it('d3: every quoted word is a clue word, and it appears in a sentence that is an opinion', () => {
    for (let s = 1; s <= 200; s++) {
      const q = gen(3, rngOf(s));
      const words = [...q.why!.matchAll(/"(\w+)"/g)].map(m => m[1]);
      expect(words.length).toBeGreaterThan(0);
      for (const w of words) { expect(OPINION_MARKERS, q.why).toContain(w); expect(wordsOf((q.visual as { text: string }).text), q.why).toContain(w); }
    }
  });
});
