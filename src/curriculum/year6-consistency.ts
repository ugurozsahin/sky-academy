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
export type TenseRow = [sentence: string, answer: string, others: string[]];

/** d2: the time word comes first or alone. A present row says "Nowadays" ("every day" and "always" also fit a habitual past, and "usually" a prediction). A future row says "Next month", never "soon", which also fits a narrative past. A future row never offers the present simple, which also names a plan ("Tomorrow my aunt visits"): its decoys are the past, the base form after a third-person subject and "would". */
export const TENSE_PLAIN: TenseRow[] = [
  ['Yesterday we went to the park and _ football.', 'played', ['play', 'plays', 'will play']],
  ['Last night my sister _ the dishes.', 'washed', ['wash', 'washes', 'will wash']],
  ['Tomorrow my aunt _ the museum.', 'will visit', ['visited', 'visit', 'would visit']],
  ['Nowadays I _ to school.', 'walk', ['walked', 'walks', 'will walk']],
  ['Next week Dad _ the car.', 'will clean', ['cleaned', 'clean', 'would clean']],
  ['Next month Gran _ you with the bags.', 'will help', ['helped', 'help', 'would help']],
  ['Nowadays my brother _ the dinner.', 'cooks', ['cooked', 'cook', 'will cook']],
  ['Two days ago we _ a film.', 'watched', ['watch', 'watches', 'will watch']],
  ['Nowadays she _ her teeth before bed.', 'cleans', ['cleaned', 'clean', 'will clean']],
  ['Last week the farmer _ his cows.', 'watched', ['watch', 'watches', 'will watch']],
];

/** d3: the clue is a verb in the second clause. A past time word opens each row too, so a habitual present ("Gran helps us after we arrived") cannot fit. "had washed" also fits there, so it is never offered. */
export const TENSE_LATE: TenseRow[] = [
  ['Yesterday I _ the dishes before Mum came home.', 'washed', ['wash', 'washes', 'will wash']],
  ['Last night we _ in the garden until Dad arrived.', 'played', ['play', 'plays', 'will play']],
  ['Yesterday the children _ home when it was dark.', 'walked', ['walk', 'walks', 'will walk']],
  ['Yesterday my sister _ the table because Gran was coming.', 'cleaned', ['clean', 'cleans', 'will clean']],
  ['Yesterday Gran _ us with the bags after we arrived.', 'helped', ['help', 'helps', 'will help']],
];

const agreeCard: (rng: Parameters<Generator>[1], row: AgreeRow, am: boolean) => ReturnType<Generator> = (rng, [sentence, answer, other], am) =>
  wordQ(rng, 'Slice the verb that fits', answer, am ? [other, 'am'] : [other], {
    visual: { type: 'sentence', text: sentence }, say: `${sentence.replace('_', 'blank')} Slice the verb that fits.`,
    hint: 'The verb agrees with the subject', hintIsData: false,
  });

const tenseCard: (rng: Parameters<Generator>[1], row: TenseRow) => ReturnType<Generator> = (rng, [sentence, answer, others]) =>
  wordQ(rng, 'Slice the verb in the right tense', answer, others, {
    visual: { type: 'sentence', text: sentence }, say: `${sentence.replace('_', 'blank')} Slice the verb in the right tense.`,
    hint: 'Keep the same tense as the time words', hintIsData: false,
  });

export const y6Consistency: Generator = (d: Difficulty, rng) => {
  if (d === 1) { const r = pick(rng, AGREE_PLAIN); return agreeCard(rng, r, r[1] === 'is' || r[1] === 'are'); }
  if (d === 2) return tenseCard(rng, pick(rng, TENSE_PLAIN));
  if (rng() < 0.5) return tenseCard(rng, pick(rng, TENSE_LATE));
  return agreeCard(rng, pick(rng, AGREE_TRAP), false);
};
