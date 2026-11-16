// y6-consistency (#1285): consistent tense and subject–verb agreement (NC Years 5–6, writing: evaluate and edit). d1 picks the
// verb that agrees with a plain subject, d2 the verb form that keeps a sentence in the tense its time words set, d3 mixes
// agreement across an intervening phrase (the trap) with tense where the anchor sits in the second clause.
// Collective nouns, "none of" and "neither of" are left out: British English allows either number (#1285).
import type { Difficulty, Generator } from './types';
import { pick, wordQ } from './util';

/** [sentence with "_", answer, the other form]. Head noun is the second word (after The/My/These/This/Our), or "Each of" is singular. */
export type AgreeRow = [sentence: string, answer: string, other: string];

/** d1: nothing between the subject and the verb. */
export const AGREE_PLAIN: AgreeRow[] = [
  ['The dogs _ hungry.', 'are', 'is'],
  ['My brother _ a bike.', 'has', 'have'],
  ['These books _ heavy.', 'are', 'is'],
  ['The children _ outside.', 'are', 'is'],
  ['My feet _ cold.', 'are', 'is'],
  ['The mouse _ very small.', 'is', 'are'],
  ['Our teachers _ kind.', 'are', 'is'],
  ['This pencil _ sharp.', 'is', 'are'],
  ['The girls _ new coats.', 'have', 'has'],
  ['My friend _ a puppy.', 'has', 'have'],
];

/** d3: a noun of the other number sits between the subject and the verb, or "Each of": the decoy agrees with that nearest noun. */
export const AGREE_TRAP: AgreeRow[] = [
  ['The box of pencils _ on the desk.', 'is', 'are'],
  ['The children in my street _ kind.', 'are', 'is'],
  ['The bag of apples _ heavy.', 'is', 'are'],
  ['The dogs in the garden _ noisy.', 'are', 'is'],
  ['The picture of the flowers _ lovely.', 'is', 'are'],
  ['The women in the shop _ busy.', 'are', 'is'],
  ['Each of the players _ a shirt.', 'has', 'have'],
  ['Each of the pupils _ a book.', 'has', 'have'],
  ['Each of the children _ a coat.', 'has', 'have'],
];

/** [sentence with "_", answer, the three other forms of the same verb]. Every sentence holds a time word or a past/future verb. */
export type TenseRow = [sentence: string, answer: string, others: string[], tense: Tense];
export type Tense = 'past' | 'present' | 'future';

/** d2: the time word comes first or alone. A present row says "Nowadays" ("every day" and "always" also fit a habitual past, and "usually" a prediction). A future row says "Next month", never "soon", which also fits a narrative past. A future row never offers the present simple, which also names a plan ("Tomorrow my aunt visits"): its decoys are the past, the base form after a third-person subject and "would". */
export const TENSE_PLAIN: TenseRow[] = [
  ['Yesterday we went to the park and _ football.', 'played', ['play', 'plays', 'will play'], 'past'],
  ['Last night my sister _ the dishes.', 'washed', ['wash', 'washes', 'will wash'], 'past'],
  ['Tomorrow my aunt _ the museum.', 'will visit', ['visited', 'visit', 'would visit'], 'future'],
  ['Nowadays I _ to school.', 'walk', ['walked', 'walks', 'will walk'], 'present'],
  ['Next week Dad _ the car.', 'will clean', ['cleaned', 'clean', 'would clean'], 'future'],
  ['Next month Gran _ you with the bags.', 'will help', ['helped', 'help', 'would help'], 'future'],
  ['Nowadays my brother _ the dinner.', 'cooks', ['cooked', 'cook', 'will cook'], 'present'],
  ['Two days ago we _ a film.', 'watched', ['watch', 'watches', 'will watch'], 'past'],
  ['Nowadays she _ her teeth before bed.', 'cleans', ['cleaned', 'clean', 'will clean'], 'present'],
  ['Last week the farmer _ his cows.', 'watched', ['watch', 'watches', 'will watch'], 'past'],
];

/** d3: the clue is a verb in the second clause. A past time word opens each row too, so a habitual present ("Gran helps us after we arrived") cannot fit. "had washed" also fits there, so it is never offered. */
export const TENSE_LATE: TenseRow[] = [
  ['Yesterday I _ the dishes before Mum came home.', 'washed', ['wash', 'washes', 'will wash'], 'past'],
  ['Last night we _ in the garden until Dad arrived.', 'played', ['play', 'plays', 'will play'], 'past'],
  ['Yesterday the children _ home when it was dark.', 'walked', ['walk', 'walks', 'will walk'], 'past'],
  ['Yesterday my sister _ the table because Gran was coming.', 'cleaned', ['clean', 'cleans', 'will clean'], 'past'],
  ['Yesterday Gran _ us with the bags after we arrived.', 'helped', ['help', 'helps', 'will help'], 'past'],
];

/** The why for agreement: names the subject and its number, never only the verb (#2318). The subject is the word after the determiner, or "Each". */
export const agreeWhy = (sentence: string, answer: string): string => {
  const w = sentence.split(' '), gap = w.indexOf('_');
  const subject = (w[0] === 'Each' ? w[0] : w[1])?.toLowerCase(), near = w[gap - 1];
  if (!subject || gap < 2 || subject === '_' || !['is', 'are', 'has', 'have'].includes(answer)) throw new Error(`agreeWhy: cannot derive the subject of "${sentence}"`);
  const number = answer === 'is' || answer === 'has' ? 'one' : 'more than one';
  return near === subject ? `The subject is ${subject}: ${number}, so ${answer}.` : `The subject is ${subject}, not ${near}: ${number}, so ${answer}.`;
};

/** The why for tense: the tense is data on the row, never guessed from the spelling (#2318). */
export const tenseWhy = (answer: string, tense: Tense): string =>
  tense === 'future' ? `The sentence looks ahead, so use will: ${answer}.`
    : tense === 'past' ? `The sentence is about the past, so use the past: ${answer}.`
      : `Nowadays means now, so use the present: ${answer}.`;

const agreeCard: (rng: Parameters<Generator>[1], row: AgreeRow, am: boolean) => ReturnType<Generator> = (rng, [sentence, answer, other], am) =>
  wordQ(rng, 'Slice the verb that fits', answer, am ? [other, 'am'] : [other], {
    visual: { type: 'sentence', text: sentence }, say: `${sentence.replace('_', 'blank')} Slice the verb that fits.`, why: agreeWhy(sentence, answer),
    hint: 'The verb agrees with the subject', hintIsData: false,
  });

const tenseCard: (rng: Parameters<Generator>[1], row: TenseRow) => ReturnType<Generator> = (rng, [sentence, answer, others, tense]) =>
  wordQ(rng, 'Slice the verb in the right tense', answer, others, {
    visual: { type: 'sentence', text: sentence }, say: `${sentence.replace('_', 'blank')} Slice the verb in the right tense.`, why: tenseWhy(answer, tense),
    hint: 'Keep the same tense as the time words', hintIsData: false,
  });

export const y6Consistency: Generator = (d: Difficulty, rng) => {
  if (d === 1) { const r = pick(rng, AGREE_PLAIN); return agreeCard(rng, r, r[1] === 'is' || r[1] === 'are'); }
  if (d === 2) return tenseCard(rng, pick(rng, TENSE_PLAIN));
  if (rng() < 0.5) return tenseCard(rng, pick(rng, TENSE_LATE));
  return agreeCard(rng, pick(rng, AGREE_TRAP), false);
};
