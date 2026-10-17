// y5-perfect (#1230): the perfect form marks time and cause (English Appendix 2, Year 5: "he had seen her before"). d1 gaps the
// helper (had, has or have) and d2 gaps the participle; d3 mixes both. Every frame carries a clear past or present anchor in its
// other clause, so exactly one helper fits both the time and the subject (#666).
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, wordQ } from './util';

/** `[base, simple past, past participle]`: the three forms always differ, so a participle bubble is never a repeat. */
export type VerbForms = readonly [base: string, past: string, participle: string];
export const PERFECT_VERBS: readonly VerbForms[] = [
  ['eat', 'ate', 'eaten'], ['go', 'went', 'gone'], ['write', 'wrote', 'written'], ['see', 'saw', 'seen'], ['take', 'took', 'taken'],
  ['break', 'broke', 'broken'], ['choose', 'chose', 'chosen'], ['speak', 'spoke', 'spoken'], ['forget', 'forgot', 'forgotten'], ['fly', 'flew', 'flown'],
];
export const PERFECT_HELPERS = ['had', 'has', 'have'] as const;
export type Helper = (typeof PERFECT_HELPERS)[number];

/** `text` has `{aux}` and `{pp}`; `third` is true for he/she/it subjects; `anchor` is the tense of the other clause. */
export interface Frame { text: string; third: boolean; anchor: 'past' | 'present'; verb: string }
const f = (text: string, third: boolean, anchor: Frame['anchor'], verb: string): Frame => ({ text, third, anchor, verb });

export const FRAMES: readonly Frame[] = [
  f('By the time we got there, the birds {aux} {pp} away.', false, 'past', 'fly'),
  f('The room was quiet because everyone {aux} {pp} home.', false, 'past', 'go'),
  f('Once she {aux} {pp} the letter, she posted it.', true, 'past', 'write'),
  f('The plate was empty because the dog {aux} {pp} the sausages.', true, 'past', 'eat'),
  f('Before Mia dropped the vase, she {aux} {pp} it from the shelf.', true, 'past', 'take'),
  f('He was sad because he {aux} {pp} his homework.', true, 'past', 'forget'),
  f('After the storm, we saw that the wind {aux} {pp} the fence.', true, 'past', 'break'),
  f('The team cheered when the coach {aux} {pp} Sam for the final.', true, 'past', 'choose'),
  f('Tom was tired because he {aux} {pp} all day.', true, 'past', 'speak'),
  f('Nobody was surprised because they {aux} {pp} the film before.', false, 'past', 'see'),
  f('I {aux} just {pp} my key, so I cannot get in.', false, 'present', 'forget'),
  f('Sam {aux} already {pp} all the biscuits, so the tin is empty now.', true, 'present', 'eat'),
  f('The children {aux} just {pp} their stories, so they can read them out now.', false, 'present', 'write'),
  f('My brother {aux} just {pp} my pen, so I cannot write now.', true, 'present', 'take'),
  f('The mug {aux} just {pp}, so we need a new one now.', true, 'present', 'break'),
  f('Ella {aux} just {pp} a book, so she is reading it now.', true, 'present', 'choose'),
  f('The birds {aux} just {pp}, so the nest is empty now.', false, 'present', 'fly'),
  f('You {aux} {pp} that film already, so you know the ending.', false, 'present', 'see'),
  f('Dad {aux} just {pp} to the shop, so he is not at home now.', true, 'present', 'go'),
  f('They {aux} just {pp} too fast, so I cannot follow now.', false, 'present', 'speak'),
];

/** The oracle for the helper: had after a past anchor; otherwise has for he/she/it and have for the rest. */
export const helperOf = (fr: Frame): Helper => fr.anchor === 'past' ? 'had' : fr.third ? 'has' : 'have';
export const formsOf = (fr: Frame): VerbForms => {
  const forms = PERFECT_VERBS.find(v => v[0] === fr.verb);
  if (!forms) throw new Error(`year5-perfect: no verb row for "${fr.verb}"`);
  return forms;
};
export const fill = (fr: Frame, aux: string, pp: string) => fr.text.replace('{aux}', aux).replace('{pp}', pp);

const PAST_FRAMES = FRAMES.filter(x => x.anchor === 'past');
const PRESENT_FRAMES = FRAMES.filter(x => x.anchor === 'present');

/** `gap` says which word is sliced: the helper or the participle. */
export const perfectQ = (rng: Rng, fr: Frame, gap: 'aux' | 'pp'): Question => {
  const [, past, pp] = formsOf(fr);
  const aux = helperOf(fr);
  const forms = formsOf(fr);
  const shown = gap === 'aux' ? fill(fr, '___', pp) : fill(fr, aux, '___');
  const blank = gap === 'aux' ? fill(fr, 'blank', pp) : fill(fr, aux, 'blank');
  return gap === 'aux'
    ? wordQ(rng, 'Slice the helper word that fits the sentence', aux, PERFECT_HELPERS.filter(h => h !== aux), {
      visual: { type: 'sentence', text: shown }, say: blank, hint: 'Look at the other part of the sentence: did it happen before, or does it matter now?', hintIsData: false,
    })
    : wordQ(rng, 'Slice the word that fits the gap', pp, [forms[0], past], {
      visual: { type: 'sentence', text: shown }, say: blank, hint: 'After had, has or have we need the form that goes with it.', hintIsData: false,
    });
};

export const y5Perfect: Generator = (difficulty: Difficulty, rng) => {
  if (difficulty === 1) return perfectQ(rng, pick(rng, FRAMES), 'aux');
  if (difficulty === 2) return perfectQ(rng, pick(rng, FRAMES), 'pp');
  return perfectQ(rng, pick(rng, rng() < 0.5 ? PAST_FRAMES : PRESENT_FRAMES), rng() < 0.5 ? 'aux' : 'pp');
};
