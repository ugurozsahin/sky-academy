// y5-fer (#1221): adding endings to -fer words, English Appendix 1 p.19. The r is doubled if the -fer is still stressed
// when the ending is added (preferred) and stays single if not (preference). The word sits in a sentence with its r's
// gapped as one `_`; the bubbles hold only `r` and `rr`.
import type { Generator, Question, Rng, Difficulty } from './types';
import { pick, wordQ } from './util';

/** `[root, ending, r is doubled, sentence with {} where the word goes]`. */
export type FerRow = readonly [root: string, ending: string, doubled: boolean, sentence: string];

/** d1: the stressed cases, where the r is doubled. */
const STRESSED: FerRow[] = [
  ['refer', 'ing', true, 'Tom is {} to the map.'],
  ['refer', 'ed', true, 'Mum {} to her notes.'],
  ['refer', 'al', true, 'The doctor wrote a {} to the hospital.'],
  ['prefer', 'ing', true, 'Ben is {} the red kite.'],
  ['prefer', 'ed', true, 'Mia {} the blue coat.'],
  ['transfer', 'ing', true, 'Dad is {} the photos to his laptop.'],
  ['transfer', 'ed', true, 'Gran {} some money to the bank.'],
  ['confer', 'ing', true, 'The two teachers are {} about the trip.'],
  ['confer', 'ed', true, 'The team {} before the match.'],
  ['infer', 'ing', true, 'Ana is {} the answer from the clues.'],
  ['infer', 'ed', true, 'Ravi {} that it had rained.'],
];
/** d2 adds the cases where the stress moves and one r stays. */
const MOVED: FerRow[] = [
  ['refer', 'ence', false, 'Look up the word in a {} book.'],
  ['refer', 'ee', false, 'The {} blew the whistle.'],
  ['prefer', 'ence', false, 'My {} is the red one.'],
  ['transfer', 'ence', false, 'Metal helps the {} of heat.'],
  ['confer', 'ence', false, 'The teachers met at a {} in town.'],
  ['infer', 'ence', false, 'She made an {} from the clues.'],
];
/** d3 adds roots whose -fer is never stressed, so the r never doubles. */
const NEVER: FerRow[] = [
  ['offer', 'ing', false, 'The shop is {} a free toy.'],
  ['offer', 'ed', false, 'Gran {} us a biscuit.'],
  ['suffer', 'ing', false, 'The sick puppy was {} from a cold.'],
  ['suffer', 'ed', false, 'He {} from a sore knee.'],
  ['differ', 'ing', false, 'The twins have {} tastes.'],
  ['differ', 'ed', false, 'The two paintings {} in colour.'],
];

export const FER_BANK: readonly FerRow[] = [...STRESSED, ...MOVED, ...NEVER];
const WORDS: Record<Difficulty, readonly FerRow[]> = { 1: STRESSED, 2: [...STRESSED, ...MOVED], 3: FER_BANK };

/** The word with its r's gapped (`prefe_ed`), and spelt out in full with the right or the wrong number of r's. */
export const ferGap = ([root, ending]: FerRow) => root.slice(0, -1) + '_' + ending;
export const ferWord = ([root, ending, doubled]: FerRow, right = true) => root.slice(0, -1) + (doubled === right ? 'rr' : 'r') + ending;

export const ferQ = (rng: Rng, row: FerRow): Question => {
  const [root, ending, doubled, sentence] = row;
  return wordQ(rng, `${root} + ${ending}`, doubled ? 'rr' : 'r', [doubled ? 'r' : 'rr'], {
    visual: { type: 'sentence', text: sentence.replace('{}', ferGap(row)) },
    say: `${sentence.replace('{}', ferWord(row))} How do you spell ${ferWord(row)}?`,
    hint: 'One r or two?', hintIsData: false,
  });
};

export const y5Fer: Generator = (difficulty, rng) => ferQ(rng, pick(rng, WORDS[difficulty]));
