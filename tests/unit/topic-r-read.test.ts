import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { CVC } from '../../src/curriculum/util';
import { R_LETTERS_P2, R_LETTERS_ALL } from '../../src/curriculum/reception';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-read')!;
const pool = (d: Difficulty) => (d === 1 ? R_LETTERS_P2 : R_LETTERS_ALL);
const rWords = (d: Difficulty) => { const letters = pool(d); return CVC.filter(([w]) => [...w].every(c => letters.includes(c))); };
const DRAWS = 150;

/**
 * #967: "Read it!" is the ELG Word Reading goal — sound-blend a *written* word, never a listened-to one — so
 * every rail here is about the word staying silent and the picture staying the only right answer.
 */
describe('r-read (#967)', () => {
  it('never speaks or prints the shown word outside the visual', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9670 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const word = q.visual?.type === 'word' ? q.visual.text : '';
        expect(word, `d${d} draw ${i}: no word shown at all`).not.toBe('');
        expect(q.prompt.toLowerCase(), `d${d} draw ${i}: prompt names the word`).not.toContain(word.toLowerCase());
        expect(q.say?.toLowerCase() ?? '', `d${d} draw ${i}: say names the word`).not.toContain(word.toLowerCase());
      }
    }
  });

  it('sets no `listen` — the word is read from the card, never heard', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9680 + d);
      for (let i = 0; i < DRAWS; i++) expect(topic.gen(d, r).listen).toBeUndefined();
    }
  });

  it('the answer is always the CVC bank emoji of the word shown, and options are all bank emoji', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9690 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const word = q.visual?.type === 'word' ? q.visual.text : '';
        const entry = CVC.find(([w]) => w === word);
        expect(entry, `d${d} draw ${i}: "${word}" is not in the CVC bank`).toBeDefined();
        expect(q.answer, `d${d} draw ${i}`).toBe(entry![1]);
        for (const o of q.options) expect(CVC.some(([, e]) => e === o), `d${d} draw ${i}: option "${o}" is not a bank emoji`).toBe(true);
      }
    }
  });

  it('the word and every decoy word are within the difficulty\'s phase pool', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9700 + d);
      const allowed = rWords(d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const o of q.options) expect(allowed.some(([, e]) => e === o), `d${d} draw ${i}: option "${o}" is outside the phase pool`).toBe(true);
      }
    }
  });

  it('d1: exactly 2 decoys, each a different first letter from the word shown', () => {
    const r = rng(9710);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      const word = q.visual?.type === 'word' ? q.visual.text : '';
      expect(q.options.length, `draw ${i}`).toBe(3);
      const decoyWords = q.options.filter(o => o !== q.answer).map(o => CVC.find(([, e]) => e === o)![0]);
      for (const dw of decoyWords) expect(dw[0], `draw ${i}: decoy "${dw}" shares a first letter with "${word}"`).not.toBe(word[0]);
    }
  });

  // pr-test-analyzer review: d1 pinned its option count, but d2/d3 (3 decoys, 4 options) never did — a
  // regression shrinking the decoy set (wordQ's own de-dup, or a future CVC entry sharing an emoji) would
  // pass every other assertion here while shipping a 3-bubble card.
  it('d2: exactly 3 decoys drawn from the phase pool, no first-letter constraint either way', () => {
    const r = rng(9715);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(2, r);
      expect(q.options.length, `draw ${i}`).toBe(4);
    }
  });

  it('d3: at least one decoy shares the first letter of the word shown — the first sound alone cannot answer', () => {
    const r = rng(9720);
    let sawSharedFirstLetter = false;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      const word = q.visual?.type === 'word' ? q.visual.text : '';
      expect(q.options.length, `draw ${i}`).toBe(4);
      const decoyWords = q.options.filter(o => o !== q.answer).map(o => CVC.find(([, e]) => e === o)![0]);
      if (decoyWords.some(dw => dw[0] === word[0])) sawSharedFirstLetter = true;
      expect(decoyWords.some(dw => dw[0] === word[0]), `draw ${i}: no decoy of "${word}" shares its first letter`).toBe(true);
    }
    expect(sawSharedFirstLetter, 'the rule never actually fired across all draws').toBe(true);
  });

  // pr-test-analyzer review: the d3 retry (`return rRead(d, rng)`) needs a same-first-letter sibling in the
  // pool to terminate, so a word that is the only one for its first letter can never be the d3 *target* — only
  // ever a decoy. That holds today (21 of 30 CVC words have a sibling) but nothing pinned it, so a future CVC
  // edit could erode it silently into a slow/failing retry with no assertion explaining why.
  it('d3: the phase pool has enough first-letter siblings for the retry to always terminate, and a singleton-first-letter word never lands as the target', () => {
    const allowed = rWords(3);
    const byFirst = new Map<string, number>();
    for (const [w] of allowed) byFirst.set(w[0], (byFirst.get(w[0]) ?? 0) + 1);
    const singletons = new Set([...byFirst].filter(([, n]) => n === 1).map(([l]) => l));
    expect(singletons.size, 'every letter must keep at least one sibling pair for the d3 retry to converge').toBeLessThan(byFirst.size);

    const r = rng(9730);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      const word = q.visual?.type === 'word' ? q.visual.text : '';
      expect(singletons.has(word[0]), `draw ${i}: "${word}" is a singleton-first-letter word but was drawn as the d3 target`).toBe(false);
    }
  });
});
