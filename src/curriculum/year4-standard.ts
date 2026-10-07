// y4-standard (#1164): Standard English verb forms — we were, I did (English Appendix 2, Year 4). d1 and d2 slice the
// Standard form into a gap; d3 shows the whole sentence with one local spoken form in it and the child slices that word.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** One bank row: the sentence with a gap, the Standard form that fits, and the local spoken form it replaces. */
export type StdRow = readonly [sentence: string, standard: string, local: string];

/** d1: was/were with pronoun subjects — both forms are right on some card. */
export const WAS_WERE: readonly StdRow[] = [
  ['We ___ late for school.', 'were', 'was'], ['They ___ in the hall.', 'were', 'was'], ['You ___ very quick.', 'were', 'was'],
  ['She ___ very tired.', 'was', 'were'], ['He ___ at the park.', 'was', 'were'], ['I ___ at home.', 'was', 'were'],
];
/** Every other pair appears twice: once where the past form is right and once where the participle is (after has, have, had). */
export const OTHER_VERBS: readonly StdRow[] = [
  ['I ___ my homework last night.', 'did', 'done'], ['I have ___ my homework.', 'done', 'did'],
  ['We ___ a fox yesterday.', 'saw', 'seen'], ['Have you ___ my coat?', 'seen', 'saw'],
  ['She ___ to school early.', 'came', 'come'], ['He has ___ to tea.', 'come', 'came'],
  ['We ___ to the park.', 'went', 'gone'], ['They have ___ home.', 'gone', 'went'],
  ['Mum ___ me a book.', 'gave', 'given'], ['I have ___ him a card.', 'given', 'gave'],
  ['He ___ a long story.', 'wrote', 'written'], ['She has ___ a letter.', 'written', 'wrote'],
];

/** d1: was/were only · d2: every verb pair · d3: find the one word that is not Standard English in a whole sentence. */
export const y4Standard: Generator = (d, rng) => {
  if (d === 3) {
    const [sentence, , local] = pick(rng, [...WAS_WERE, ...OTHER_VERBS]);
    const text = sentence.replace('___', local);
    const others = [...new Set(text.replace(/[.?!]/g, '').split(' '))].filter(w => w !== local);
    return wordQ(rng, 'Which word is not Standard English?', local, shuffle(rng, others).slice(0, 3), {
      visual: { type: 'sentence', text }, say: text, hint: 'One verb here is a local spoken form.', hintIsData: false, wide: true,
    });
  }
  const [sentence, standard, local] = pick(rng, d === 1 ? WAS_WERE : [...WAS_WERE, ...OTHER_VERBS]);
  return wordQ(rng, 'Which is Standard English?', standard, [local], {
    visual: { type: 'sentence', text: sentence }, say: sentence.replace('___', 'blank'),
    hint: 'Which verb do we write in Standard English?', hintIsData: false,
  });
};
