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

  it('d3: at least one decoy shares the first letter of the word shown — the first sound alone cannot answer', () => {
    const r = rng(9720);
    let sawSharedFirstLetter = false;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      const word = q.visual?.type === 'word' ? q.visual.text : '';
      const decoyWords = q.options.filter(o => o !== q.answer).map(o => CVC.find(([, e]) => e === o)![0]);
      if (decoyWords.some(dw => dw[0] === word[0])) sawSharedFirstLetter = true;
      expect(decoyWords.some(dw => dw[0] === word[0]), `draw ${i}: no decoy of "${word}" shares its first letter`).toBe(true);
    }
    expect(sawSharedFirstLetter, 'the rule never actually fired across all draws').toBe(true);
  });
});
