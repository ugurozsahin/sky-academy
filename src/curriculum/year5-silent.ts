// y5-silent (#1229): English Appendix 1, Years 5 and 6 — words with "silent" letters. d1 finds the letter you cannot
// hear, d2 puts it back into a gapped word in a sentence, d3 spells the whole word from the voice. kn, gn and wr belong
// to the Year 2 topic, and the Year 5–6 list words (muscle, rhyme, yacht…) to the word-list topics. Words that sound
// like another word (knight, sword, yolk, hymn, aisle) are left out: a spoken word must not have a sound-alike.
import type { Generator, Question, Rng } from './types';
import { pick, shuffle, spellQ, wordQ } from './util';

/** `[word, silent letter's index, sentence, two gap decoys]` — a decoy in the gap never makes a real word. */
export type SilentRow = readonly [word: string, at: number, sentence: string, decoys: readonly [string, string]];

/** One silent letter, heard nowhere else in the word (d1, d2, d3). */
export const ONE_BANK: readonly SilentRow[] = [
  ['doubt', 3, 'I have no doubt that you can do it.', ['p', 'g']],
  ['debt', 2, 'He paid back every penny of his debt.', ['k', 'g']],
  ['lamb', 3, 'The lamb followed its mother.', ['t', 'g']],
  ['thumb', 4, 'She hurt her thumb in the door.', ['t', 'g']],
  ['comb', 3, 'Use a comb to tidy your hair.', ['t', 'g']],
  ['crumb', 4, 'A crumb of cake fell on the floor.', ['t', 'g']],
  ['tomb', 3, 'The king was buried in a stone tomb.', ['d', 't']],
  ['limb', 3, 'The cat sat on a high limb of the tree.', ['t', 'g']],
  ['numb', 3, 'My fingers went numb in the snow.', ['p', 't']],
  ['island', 1, 'The boat sailed to a small island.', ['t', 'c']],
  ['solemn', 5, 'The room was quiet and solemn.', ['t', 'p']],
  ['autumn', 5, 'Leaves fall from the trees in autumn.', ['m', 't']],
  ['column', 5, 'A tall column held up the roof.', ['m', 't']],
  ['calm', 2, 'The sea was calm and still.', ['r', 't']],
  ['palm', 2, 'The palm of my hand is warm.', ['t', 'n']],
  ['salmon', 2, 'The salmon swam up the river.', ['t', 'r']],
  ['answer', 3, 'Put up your hand to answer.', ['t', 'n']],
  ['honest', 0, 'It is always best to be honest.', ['b', 'd']],
  ['fasten', 3, 'Please fasten your seat belt.', ['k', 'd']],
  ['guitar', 1, 'He plays a tune on his guitar.', ['o', 'a']],
  ['guard', 1, 'A guard stood at the gate.', ['o', 'i']],
  ['biscuit', 4, 'Have a biscuit with your milk.', ['o', 'a']],
  ['scissors', 1, 'Cut the card with scissors.', ['h', 'k']],
];
/** Two silent letters, or a word whose own name would trip the prompt ("Which letter is silent in listen?" contains the word the
 * no-voice rule reads as an instruction to listen): gapped and spelt, never found (d2, d3). */
export const MORE_BANK: readonly SilentRow[] = [
  ['listen', 3, 'Please listen to the story.', ['k', 'd']],
  ['glisten', 4, 'The frost made the lake glisten.', ['k', 'd']],
  ['thistle', 4, 'A thistle grew by the path.', ['k', 'd']],
  ['castle', 3, 'The king lived in a castle.', ['k', 'd']],
  ['whistle', 4, 'Blow the whistle to start the race.', ['k', 'd']],
  ['condemn', 6, 'We condemn unkind words.', ['m', 't']],
  ['psalm', 0, 'The choir sang a psalm.', ['t', 'm']],
];
export const SILENT_BANK: readonly SilentRow[] = [...ONE_BANK, ...MORE_BANK];

/** d1: the word is on the card; the silent letter and up to three sounded letters of the same word are the bubbles. */
export function findQ(rng: Rng, [word, at, , ]: SilentRow): Question {
  const silent = word[at];
  const others = [...new Set(word.split('').filter(l => l !== silent))];
  return wordQ(rng, `Which letter is silent in ${word}?`, silent, shuffle(rng, others), {
    visual: { type: 'word', text: word }, say: `Which letter is silent in ${word}?`,
    hint: 'Say the word. Which letter can you not hear?', hintIsData: false,
  });
}

/** d2: the sentence shows the word with the silent letter gapped; the voice reads the whole sentence. */
export function putBackQ(rng: Rng, [word, at, sentence, decoys]: SilentRow): Question {
  const gapped = `${word.slice(0, at)}_${word.slice(at + 1)}`;
  return wordQ(rng, 'Which letter is missing?', word[at], [...decoys], {
    visual: { type: 'sentence', text: sentence.replace(word, gapped) }, say: sentence,
    hint: 'Say the whole word. Which letter do you not hear?', hintIsData: false,
  });
}

/** d3: hear the word and build all of it; a no-voice device peeks at the word first. */
export function spellSilentQ(rng: Rng, [word]: SilentRow): Question {
  return { ...spellQ(rng, word), peek: true, peekHint: 'Slice the letters in order' };
}

/** d1 find it · d2 put it back · d3 spell it. */
export const y5Silent: Generator = (d, rng) =>
  d === 1 ? findQ(rng, pick(rng, ONE_BANK)) : d === 2 ? putBackQ(rng, pick(rng, SILENT_BANK)) : spellSilentQ(rng, pick(rng, SILENT_BANK));
