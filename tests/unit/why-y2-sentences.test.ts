// #2318 (y2-sentencetype, y2-tense): the why says what the kind of sentence does, or why the tense is what it is.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const all = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d))));

describe('sentence-type and tense topics say why (#2318)', () => {
  it('y2-sentencetype: the why matches the answer and is never the bare answer', () => {
    for (const q of all('y2-sentencetype')) {
      expect(q.why).toBeTruthy();
      expect(q.why!.toLowerCase()).toContain(q.answer);
      expect(q.why).not.toBe(q.answer);
    }
  });
  it('y2-tense: the why names the tense the card is about, never the other one', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (let n = 0; n < 200; n++) {
        const q = TOPICS.find(x => x.id === 'y2-tense')!.gen(d, rngOf((n + 1) * 104729 + d));
        // d1/d2 answer the tense itself; d3 answers a verb form, so the frame's own tense words decide it
        const past = d < 3 ? q.answer === 'past' : /\b(Yesterday|Last week|was|were)\b/.test(q.prompt);
        expect(q.why, q.prompt).toMatch(past ? /happened already/ : /happening now/);
        expect(q.why, q.prompt).not.toMatch(past ? /happening now/ : /happened already/);
        if (d === 3) expect(q.why!.startsWith(`${q.answer}:`), q.why).toBe(true);
      }
    }
  });
});
