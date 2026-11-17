// #2318: r-sentence, y1-sentence, y2-sentence and y3-dictation (all sentenceQ) say why after a wrong slice: the first word and the closing mark.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;
const MARK: Record<string, string> = { '.': 'a full stop', '?': 'a question mark', '!': 'an exclamation mark' };

describe('sentence games say why (#2318)', () => {
  it.each(['r-sentence', 'y1-sentence', 'y2-sentence', 'y3-dictation'])('%s: the why names the first word and the right mark', id => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(id)(d, rngOf(s));
      const sentence = String(q.answer);
      expect(q.why).toBe(`Starts "${sentence.split(' ')[0]}", ends with ${MARK[sentence.slice(-1)]}.`);
      expect(q.why).not.toBe(q.answer);
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });
});
