// y4-pronouns (#1168): pronoun or noun, for clarity (English Appendix 2, Year 4 — "appropriate choice of pronoun or noun within
// and across sentences to aid cohesion and avoid repetition"). d1 a subject pronoun, d2 adds object pronouns and plural antecedents,
// d3 adds two same-gender nouns, where only the noun is clear. Antecedents are role nouns and objects, never names or animals.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** Who or what the pronoun stands for: F she/her, M he/him, T it/it, P they/them. */
export type Ant = 'F' | 'M' | 'T' | 'P';
/** [text with one gap, antecedent]. A subject gap follows "Then "; an object gap is the last word before the full stop. */
export type Row = readonly [text: string, ant: Ant];

export const SUBJ_ONE: readonly Row[] = [
  ['Grandma was very tired. Then ___ went to bed.', 'F'], ['My sister was cold. Then ___ put on a coat.', 'F'],
  ['The king was very proud. Then ___ gave a speech.', 'M'], ['My brother was hungry. Then ___ ate his lunch.', 'M'],
  ['The ball was old. Then ___ rolled away.', 'T'], ['The box was heavy. Then ___ fell down.', 'T'],
];
export const SUBJ_PLURAL: readonly Row[] = [
  ['The girls were tired. Then ___ went home.', 'P'], ['The boys were loud. Then ___ ran off.', 'P'], ['The kites were red. Then ___ flew high.', 'P'],
];
export const OBJ: readonly Row[] = [
  ['Grandma was lost. We could not find ___.', 'F'], ['My sister was sad. We wanted to help ___.', 'F'],
  ['The king was sad. We waved to ___.', 'M'], ['My brother was late. We waited for ___.', 'M'],
  ['The ball was lost. We looked for ___.', 'T'], ['The girls were loud. We could hear ___.', 'P'], ['The kites were high. We watched ___.', 'P'],
];

/** d3: [text, the noun that makes it clear, the ambiguous pronoun, its object form, a pronoun of the wrong gender or kind]. */
export type NounRow = readonly [text: string, noun: string, ambiguous: string, objectForm: string, wrong: string];
export const NOUN_BANK: readonly NounRow[] = [
  ['The king met the prince. ___ bowed low.', 'The prince', 'He', 'Him', 'It'],
  ['My brother met the king. ___ smiled.', 'The king', 'He', 'Him', 'It'],
  ['The prince saw my brother. ___ waved.', 'My brother', 'He', 'Him', 'It'],
  ['Grandma hugged my sister. ___ laughed.', 'My sister', 'She', 'Her', 'It'],
  ['My sister called Grandma. ___ was out.', 'Grandma', 'She', 'Her', 'It'],
  ['The ball hit the box. ___ fell over.', 'The box', 'It', 'Them', 'He'],
  ['The box sat by the ball. ___ was red.', 'The ball', 'It', 'Them', 'He'],
];

/** The pronoun that fits, and the wrong-case, wrong-gender and wrong-number pronouns. A single person never gets they or them as a decoy: singular "they" is standard English. */
const SUBJ_FORM: Record<Ant, { ans: string; decoys: string[] }> = {
  F: { ans: 'she', decoys: ['her', 'he', 'it'] }, M: { ans: 'he', decoys: ['him', 'she', 'it'] },
  T: { ans: 'it', decoys: ['they', 'he', 'she'] }, P: { ans: 'they', decoys: ['them', 'he', 'she', 'it'] },
};
const OBJ_FORM: Record<Ant, { ans: string; decoys: string[] }> = {
  F: { ans: 'her', decoys: ['she', 'him', 'it'] }, M: { ans: 'him', decoys: ['he', 'her', 'it'] },
  T: { ans: 'it', decoys: ['they', 'him', 'her'] }, P: { ans: 'them', decoys: ['they', 'him', 'her', 'it'] },
};

const PROMPT = 'Which word fits best?';
const PROMPT_CLEAR = 'Which word makes the meaning clear?';

function pronoun(rng: () => number, rows: readonly Row[], forms: Record<Ant, { ans: string; decoys: string[] }>, bubbles: number): Question {
  const [text, ant] = pick(rng, rows), f = forms[ant];
  return wordQ(rng, PROMPT, f.ans, shuffle(rng, f.decoys).slice(0, bubbles - 1), {
    visual: { type: 'sentence', text }, say: `${text.replace('___', 'blank')} ${PROMPT}`,
    hint: 'The word has to match who or what the first sentence is about.', hintIsData: false,
  });
}

/** d3: two same-gender nouns come before the gap, so a pronoun could mean either; the answer is a noun. */
function clear(rng: () => number): Question {
  const [text, noun, amb, obj, wrong] = pick(rng, NOUN_BANK);
  return wordQ(rng, PROMPT_CLEAR, noun, [amb, obj, wrong], {
    visual: { type: 'sentence', text }, say: `${text.replace('___', 'blank')} ${PROMPT_CLEAR}`, wide: true,
    hint: 'Two people or things fit the pronoun, so use the noun.', hintIsData: false,
  });
}

/** d1: subject pronoun, 3 bubbles · d2: subject and object pronouns, plural antecedents, 4 bubbles · d3: d2 cards mixed with cards where the noun is clearer. */
export const y4Pronouns: Generator = (d, rng) => {
  if (d === 1) return pronoun(rng, SUBJ_ONE, SUBJ_FORM, 3);
  if (d === 3 && rng() < 0.5) return clear(rng);
  const r = rng();
  return r < 0.4 ? pronoun(rng, [...SUBJ_ONE, ...SUBJ_PLURAL], SUBJ_FORM, 4) : pronoun(rng, OBJ, OBJ_FORM, 4);
};
