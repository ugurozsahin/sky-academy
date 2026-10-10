// Shared by the Year 2 spelling-rule topics (#1009 and its siblings #1010–#1014): a hand-curated bank card
// `[word, sentence with ___, decoys]` and the one place the card is built from it.
import type { Question, Rng } from './types';
import { shuffle, wordQ } from './util';

/**
 * Real words met while curating decoys, which no spelling-rule card may offer as a wrong spelling: a child who
 * slices `nee` has read a word, not misspelt one. A commented set rather than a filter, so the next topic adds
 * what it met and says why. **Not** `AVOID` — that set means "crude", and its rails assert it (#324).
 */
export const REAL_LOOKALIKES: ReadonlySet<string> = new Set([
  'nock', 'nee', 'nome', 'nat', 'wrung', 'wist', 'ren', 'rap', 'ring', 'rite', 'right', 'no', 'new', 'night', 'not', 'nit', 'nose', 'nor', 'rote', 'doge', 'cadge',
  // real words met curating y5-cious (#1218): officious (meddling), specious (misleadingly plausible)
  'officious', 'specious',
]);

/** One bank row: the answer, its sentence with a `___` gap, and the invented non-words that are wrong spellings. */
export type SpellRuleRow = readonly [word: string, sentence: string, decoys: readonly string[]];

/**
 * A "which spelling is right?" card. `say` speaks the whole word and then the sentence with "blank", so a child
 * hears which word is meant; with the voice off the sentence still tells them (no-voice play, `types.ts`).
 * `bubbles` counts the answer too.
 */
export function spellRuleQ(rng: Rng, [word, sentence, decoys]: SpellRuleRow, bubbles: number): Question {
  return wordQ(rng, 'Which spelling is right?', word, shuffle(rng, decoys).slice(0, bubbles - 1), {
    visual: { type: 'sentence', text: sentence },
    say: `${word}. ${sentence.replace('___', 'blank')}`,
    hint: 'Slice the right spelling', hintIsData: false,
  });
}
