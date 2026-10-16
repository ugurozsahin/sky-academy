// y5-ant (#1219): the Year 5–6 endings -ant/-ent, -ance/-ence and -ancy/-ency, English Appendix 1 p.18.
// The word stays on the card with its ending gapped; the bubbles hold only the a-ending and the e-ending of one shape.
// Left out: assistant/assistance (every decoy on "assist" holds `ass`, an `AVOID` entry), and confident/decent, which have
// real a-twins (confidant, decant). Real look-alikes (hesitance, dependant, pendant…) live in `spelling-rules.ts`.
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, wordQ } from './util';

/** `[stem, right ending, wrong twin ending, root clue or null, sentence with the ending gapped]`. */
export type AntRow = readonly [stem: string, ending: string, twin: string, clue: string | null, sentence: string];

/** d1: -ant/-ent adjectives, each with the related word that gives the sound away (hesitant ← hesitation). */
const ADJ: AntRow[] = [
  ['observ', 'ant', 'ent', 'observation', 'A good detective is observ___.'],
  ['expect', 'ant', 'ent', 'expectation', 'The expect___ crowd cheered.'],
  ['toler', 'ant', 'ent', 'toleration', 'Be toler___ of other people.'],
  ['hesit', 'ant', 'ent', 'hesitation', 'Tom was hesit___ at the edge of the lake.'],
  ['presid', 'ent', 'ant', 'presidential', 'The club chose a new presid___.'],
  ['resid', 'ent', 'ant', 'residential', 'Every resid___ got a letter.'],
];
/** d2: -ance/-ence nouns, with a clue where the NC gives one. */
const NOUN: AntRow[] = [
  ['observ', 'ance', 'ence', 'observation', 'Her observ___ of the rules was perfect.'],
  ['toler', 'ance', 'ence', 'toleration', 'Please show some toler___ to others.'],
  ['subst', 'ance', 'ence', 'substantial', 'Glue is a sticky subst___.'],
  ['resid', 'ence', 'ance', 'residential', 'The queen lives in a royal resid___.'],
  ['evid', 'ence', 'ance', 'evidential', 'The police found evid___ in the garden.'],
  ['innoc', 'ence', 'ance', null, 'He proved his innoc___.'],
];
/** d3 adds -ancy/-ency and the words that "just have to be learnt", with no clue. */
const LEARNT: AntRow[] = [
  ['hesit', 'ancy', 'ency', null, 'She spoke without hesit___.'],
  ['vac', 'ancy', 'ency', null, 'The hotel has a vac___ for a family.'],
  ['frequ', 'ency', 'ancy', null, 'The frequ___ of the buses is every ten minutes.'],
  ['flu', 'ency', 'ancy', null, 'He reads with great flu___.'],
  ['ag', 'ency', 'ancy', null, 'Mum works for a travel ag___.'],
  ['urg', 'ency', 'ancy', null, 'There is no urg___, so take your time.'],
  ['emerg', 'ency', 'ancy', null, 'Call 999 in an emerg___.'],
  ['dec', 'ency', 'ancy', null, 'Show some dec___ and say sorry.'],
  ['obedi', 'ent', 'ant', null, 'A good dog is obedi___.'],
  ['obedi', 'ence', 'ance', null, 'The pupils showed obedi___ to the teacher.'],
  ['independ', 'ent', 'ant', null, 'At eleven you grow more independ___.'],
  ['independ', 'ence', 'ance', null, 'The country won its independ___.'],
  ['innoc', 'ent', 'ant', null, 'The puppy looked innoc___.'],
  ['frequ', 'ent', 'ant', null, 'Rain is frequ___ in April.'],
  ['excell', 'ent', 'ant', null, 'Your story is excell___.'],
  ['import', 'ant', 'ent', null, 'It is import___ to drink water.'],
  ['dist', 'ant', 'ent', null, 'We saw a dist___ hill.'],
  ['eleg', 'ant', 'ent', null, 'She wore an eleg___ dress.'],
  ['pleas', 'ant', 'ent', null, 'We had a pleas___ walk.'],
  ['ignor', 'ant', 'ent', null, 'He was ignor___ of the danger.'],
];

export const ANT_BANK: readonly AntRow[] = [...ADJ, ...NOUN, ...LEARNT];
const WORDS: Record<Difficulty, readonly AntRow[]> = { 1: ADJ, 2: NOUN, 3: ANT_BANK };

export const antQ = (rng: Rng, row: AntRow, showClue: boolean): Question => {
  const [stem, ending, twin, clue, sentence] = row;
  return wordQ(rng, showClue && clue ? `Clue: ${clue}. Which ending?` : 'Which ending is right?', ending, [twin], {
    visual: { type: 'sentence', text: sentence },
    say: `${sentence.replace('___', ending)} Which ending spells ${stem + ending}?`,
    hint: 'Slice the right ending', hintIsData: false,
  });
};

export const y5Ant: Generator = (difficulty, rng) => antQ(rng, pick(rng, WORDS[difficulty]), difficulty < 3);
