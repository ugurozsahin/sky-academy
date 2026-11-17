// #2318: y4-context says why: the clue word in the sentence that picks the sense.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { BANK } from '../../src/curriculum/year4-context';
import { wordsOf } from '../../src/curriculum/year5-factopinion';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y4-context')!.gen;

describe('y4-context says why (#2318)', () => {
  it('every row has a clue word that is in its sentence and is not the word itself', () => {
    for (const [sentence, word, , clue] of BANK) {
      expect(wordsOf(sentence), `${sentence} / ${clue}`).toContain(clue);
      expect(clue).not.toBe(word);
    }
  });
  it('the why quotes that row\'s clue and names the keyed sense, never the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const text = (q.visual as { text: string }).text;
      const row = BANK.find(r => r[0] === text)!;
      expect(q.why).toBe(`"${row[3]}" tells you "${row[1]}" means ${q.answer} here.`);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
