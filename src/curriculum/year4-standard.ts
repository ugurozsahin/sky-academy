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

/** #2318: the why gives the rule, never the bare answer: was/were go by the subject, done/seen/gone by the word before the gap. */
export function standardWhy([sentence, standard, local]: StdRow): string {
  if (standard === 'was' || standard === 'were') return `With "${sentence.split(' ')[0].toLowerCase()}", use "${standard}", not "${local}".`;
  const aux = /\b(has|have|had)\b/i.exec(sentence.split('___')[0]);
  return aux ? `After "${aux[1].toLowerCase()}", use "${standard}", not "${local}".` : `On its own, use the past: "${standard}", not "${local}".`;
}

/** d1: was/were only · d2: every verb pair · d3: find the one word that is not Standard English in a whole sentence. */
export const y4Standard: Generator = (d, rng) => {
  if (d === 3) {
    const row = pick(rng, [...WAS_WERE, ...OTHER_VERBS]);
    const [sentence, , local] = row;
    const text = sentence.replace('___', local);
    const others = [...new Set(text.replace(/[.?!]/g, '').split(' '))].filter(w => w !== local);
    return wordQ(rng, 'Which word is not Standard English?', local, shuffle(rng, others).slice(0, 3), {
      visual: { type: 'sentence', text }, say: text, hint: 'One verb here is a local spoken form.', hintIsData: false, wide: true, why: standardWhy(row),
    });
  }
  const row = pick(rng, d === 1 ? WAS_WERE : [...WAS_WERE, ...OTHER_VERBS]);
  const [sentence, standard, local] = row;
  return wordQ(rng, 'Which is Standard English?', standard, [local], {
    visual: { type: 'sentence', text: sentence }, say: sentence.replace('___', 'blank'),
    hint: 'Which verb do we write in Standard English?', hintIsData: false, why: standardWhy(row),
  });
};
