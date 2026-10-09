// y5-able (#1220): English Appendix 1, Years 5 and 6 — words ending in -able/-ible and -ably/-ibly. The child hears
// the whole word, sees it in a sentence with the ending gapped (`poss___`) and slices the right ending. The stem
// stays on the card, so no bubble is longer than five letters.
//
// Left out on purpose, because both spellings are real: forceable/forcible, collectable/collectible. A decoy is
// never a real word either: stem + decoy is checked against `GAP_WORDS`, `AVOID` and `REAL_LOOKALIKES` in the
// topic's test. Each card only offers endings of its own shape — an adverb card never offers `able`/`ible`,
// which would complete to the real adjective ("terr" + "ible").
import type { Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

/** `[stem, answer, decoys, sentence]` — the word is stem + answer; the sentence has the gap written `stem___`. */
export type AbleRow = readonly [stem: string, answer: string, decoys: readonly string[], sentence: string];

/** -able with a root word you can hear, and -ible with none (d1). */
export const ADJ_BANK: readonly AbleRow[] = [
  ['depend', 'able', ['ible', 'eable'], 'You can be depend___ and kind.'],
  ['comfort', 'able', ['ible', 'eable'], 'The sofa is very comfort___.'],
  ['enjoy', 'able', ['ible', 'eable'], 'It was an enjoy___ trip.'],
  ['reason', 'able', ['ible', 'eable'], 'That is a reason___ price.'],
  ['understand', 'able', ['ible', 'eable'], 'Her story was easy and understand___.'],
  ['reli', 'able', ['ible', 'eable'], 'My bike is old but reli___.'],
  ['poss', 'ible', ['able', 'eable'], 'Is it poss___ to see the sea from here?'],
  ['horr', 'ible', ['able', 'eable'], 'The soup had a horr___ smell.'],
  ['terr', 'ible', ['able', 'eable'], 'It was a terr___ storm.'],
  ['vis', 'ible', ['able', 'eable'], 'The moon is vis___ over the hill.'],
  ['incred', 'ible', ['able', 'eable'], 'What an incred___ jump!'],
  ['sens', 'ible', ['able', 'eable'], 'Wear a sens___ pair of shoes.'],
];
/** The same words as adverbs (d2). */
export const ADV_BANK: readonly AbleRow[] = [
  ['ador', 'ably', ['ibly', 'eably'], 'The puppy tilted its head ador___.'],
  ['consider', 'ably', ['ibly', 'eably'], 'It is consider___ colder today.'],
  ['toler', 'ably', ['ibly', 'eably'], 'He sang toler___ well.'],
  ['comfort', 'ably', ['ibly', 'eably'], 'We sat comfort___ by the fire.'],
  ['reason', 'ably', ['ibly', 'eably'], 'She asked reason___ nicely.'],
  ['depend', 'ably', ['ibly', 'eably'], 'The bus runs depend___ every day.'],
  ['poss', 'ibly', ['ably', 'eibly'], 'We could poss___ win.'],
  ['horr', 'ibly', ['ably', 'eibly'], 'The dog barked horr___ loudly.'],
  ['terr', 'ibly', ['ably', 'eibly'], 'I am terr___ sorry.'],
  ['vis', 'ibly', ['ably', 'eibly'], 'He was vis___ upset.'],
  ['incred', 'ibly', ['ably', 'eibly'], 'The tower was incred___ tall.'],
  ['sens', 'ibly', ['ably', 'eibly'], 'She acted sens___ in the dark.'],
];
/** The -ce/-ge rule: the e is kept before -able (d3 only). */
export const KEEP_E_BANK: readonly AbleRow[] = [
  ['chang', 'eable', ['able', 'ible'], 'The weather is very chang___.'],
  ['notic', 'eable', ['able', 'ible'], 'There was a notic___ smell of toast.'],
  ['leg', 'ible', ['able', 'eable'], 'Her writing is neat and leg___.'],
];

/** One card: 2 bubbles on d1 and d2, 3 on d3. `say` speaks the whole word, then the sentence with "blank". */
export function ableQ(rng: Rng, [stem, answer, decoys, sentence]: AbleRow, bubbles: number): Question {
  return wordQ(rng, 'Which ending is right?', answer, shuffle(rng, decoys).slice(0, bubbles - 1), {
    visual: { type: 'sentence', text: sentence },
    say: `${stem}${answer}. ${sentence.replace(`${stem}___`, 'blank')}`,
    hint: 'Can you hear a whole word before the ending?', hintIsData: false,
  });
}

/** d1: adjectives -able/-ible · d2: adverbs -ably/-ibly · d3: everything, with the -ce/-ge cards. */
export const y5Able: Generator = (d, rng) => {
  const bank = d === 1 ? ADJ_BANK : d === 2 ? ADV_BANK : [...ADJ_BANK, ...ADV_BANK, ...KEEP_E_BANK];
  return ableQ(rng, pick(rng, bank), d === 3 ? 3 : 2);
};
