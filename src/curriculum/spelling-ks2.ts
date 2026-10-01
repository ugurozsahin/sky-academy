// Shared builders for the KS2 statutory spelling-list topics (#1102; #1157, #1217, #1236 reuse them).
// `chunkQ` builds a long word from short chunks, `wordListQ` builds one dictation card from a list entry.
// Defined here once: a later list topic imports them and never redeclares them.
import type { Difficulty, Question, Rng } from './types';
import { pick, shuffle, spellQ } from './util';

/** One spelt form of a list entry, with its dictation sentence; `chunks`/`decoys` set only for long forms. */
export interface WordForm { w: string; s: string; chunks?: string[]; decoys?: string[] }
/** One entry as the Appendix 1 list prints it (`busy/business`, `accident(ally)`), with each form it allows. */
export interface WordEntry { printed: string; forms: WordForm[] }

/**
 * Spell a word by slicing its chunks in order. `chunks` join to `word`; `decoyChunks` are common
 * misspellings of one of them. Every label stays at 4 characters or fewer so no bubble needs `wide`.
 */
export function chunkQ(rng: Rng, word: string, chunks: string[], decoyChunks: string[], extra: Partial<Question> = {}): Question {
  const uniq = [...new Set(chunks)];
  const ds = decoyChunks.filter(c => !uniq.includes(c));
  return {
    prompt: 'Spell the word', say: `Spell the word ${word}`, answer: word, sequence: chunks,
    options: shuffle(rng, [...uniq, ...ds]), hint: 'Slice the parts in order', hintIsData: false, listen: word, ...extra,
  };
}

/**
 * One dictation card for a list entry. d1 hears the word alone; d2/d3 hear it in a sentence, which the card
 * shows with the word as `___`. With no voice the word peeks, then hides before the bubbles launch.
 */
export function wordListQ(rng: Rng, entry: WordEntry, d: Difficulty): Question {
  const f = pick(rng, entry.forms);
  const dictation = d === 1 ? {} : { say: `The word is ${f.w}. ${f.s} The word is ${f.w}.`, visual: { type: 'sentence' as const, text: f.s.replace(f.w, '___') } };
  if (f.chunks) return chunkQ(rng, f.w, f.chunks, f.decoys ?? [], { ...dictation, peek: true, peekHint: 'Slice the parts in order' });
  return { ...spellQ(rng, f.w), ...dictation, peek: true, peekHint: 'Slice the letters in order' };
}
