import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { R_RHYMES, R_RHYME_BANK } from '../../src/curriculum/reception-rhyme';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-rhyme')!;
const DRAWS = 150;
const byEmoji = new Map(R_RHYME_BANK.map(([w, r, e]) => [e, { w, r }]));
const rimeOf = (r: string) => R_RHYMES.find(x => x.rime === r)!;

/** #972: spot a rhyme. The oracle is the hand-keyed bank, never the spelling of the words. */
describe('r-rhyme "Which picture rhymes with cat?" (#972)', () => {
  it('the bank has at least 5 rimes, each with at least 2 entries, and no word is in AVOID', () => {
    expect(R_RHYMES.length).toBeGreaterThanOrEqual(5);
    for (const { rime } of R_RHYMES) expect(R_RHYME_BANK.filter(([, r]) => r === rime).length, rime).toBeGreaterThanOrEqual(2);
    for (const [w, r] of R_RHYME_BANK) { expect(AVOID.has(w), w).toBe(false); expect(R_RHYMES.some(x => x.rime === r), w).toBe(true); }
    expect(new Set(R_RHYME_BANK.map(b => b[2])).size, 'one emoji per word').toBe(R_RHYME_BANK.length);
  });

  it('shows and speaks the word, so the card works with the voice off', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9720 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.visual?.type).toBe('word');
        const word = q.visual?.type === 'word' ? q.visual.text : '';
        expect(word).not.toBe('');
        expect(q.prompt).toBe(`Which picture rhymes with ${word}?`);
        expect(q.say).toBe(q.prompt);
      }
    }
  });

  it('exactly one option rhymes with the word, and it is never the word itself', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9730 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const word = q.visual?.type === 'word' ? q.visual.text : '';
        const rime = R_RHYME_BANK.find(([w]) => w === word)![1];
        expect(q.options.filter(o => byEmoji.get(o)!.r === rime), `d${d} draw ${i} ${word}`).toEqual([q.answer]);
        expect(byEmoji.get(q.answer)!.w, `d${d} draw ${i}`).not.toBe(word);
      }
    }
  });

  it('decoys never half-rhyme: no shared vowel sound or final sound, and no two decoys rhyme', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9740 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const word = q.visual?.type === 'word' ? q.visual.text : '';
        const t = rimeOf(R_RHYME_BANK.find(([w]) => w === word)![1]);
        const decoys = q.options.filter(o => o !== q.answer).map(o => rimeOf(byEmoji.get(o)!.r));
        for (const x of decoys) { expect(x.vowel, `d${d} ${word} vs ${x.rime}`).not.toBe(t.vowel); expect(x.end, `d${d} ${word} vs ${x.rime}`).not.toBe(t.end); }
        expect(new Set(decoys.map(x => x.rime)).size).toBe(decoys.length);
      }
    }
  });

  it('the ladder is 1, 2, 3 decoys', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9750 + d);
      for (let i = 0; i < 40; i++) expect(topic.gen(d, r).options).toHaveLength(d + 1);
    }
  });
});
