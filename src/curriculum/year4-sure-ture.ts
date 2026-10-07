// y4-sure-ture (#1159): the endings of English Appendix 1, Years 3–4 — /ʒə/ is always -sure, /tʃə/ is often -ture
// (but teacher, catcher… are a root in -ch plus -er), /ʒən/ is -sion. The child hears the word, sees it in a gap
// sentence with the stem written out and slices the ending. Every wrong ending makes an invented non-word.
//
// Left out on purpose: "future" (fu + sion spells the real word "fusion"), "nature" (na + sion is a real, if
// obscure, word) — the test pins every assembled spelling, so a new bank row that spells a word fails there.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** One bank row: the stem, the ending that completes it, and a sentence with `___` where the ending goes. */
export type SureTureRow = readonly [stem: string, ending: string, sentence: string];

export const SURE_BANK: readonly SureTureRow[] = [
  ['mea', 'sure', 'Use a ruler to mea___ the pencil.'],
  ['trea', 'sure', 'The pirates dug up the trea___.'],
  ['plea', 'sure', 'It was a plea___ to meet your friend.'],
  ['enclo', 'sure', 'The sheep stayed in their enclo___.'],
  ['lei', 'sure', 'Dad reads in his lei___ time.'],
];
export const TURE_BANK: readonly SureTureRow[] = [
  ['crea', 'ture', 'A dragon is a magical crea___.'],
  ['furni', 'ture', 'A table and a chair are furni___.'],
  ['pic', 'ture', 'She put a pic___ on the wall.'],
  ['adven', 'ture', 'The explorers had a great adven___.'],
  ['mix', 'ture', 'Stir the cake mix___ well.'],
  ['cap', 'ture', 'The net will cap___ the moth.'],
];
export const SION_BANK: readonly SureTureRow[] = [
  ['divi', 'sion', 'Sharing equally is called divi___.'],
  ['inva', 'sion', 'The castle held out against the inva___.'],
  ['confu', 'sion', 'There was confu___ when the lights went out.'],
  ['deci', 'sion', 'It is hard to make a deci___.'],
  ['colli', 'sion', 'The two toy cars had a colli___.'],
  ['televi', 'sion', 'We watch a film on the televi___.'],
];
/** Teacher-type words: the /tʃə/ ending is a plain -cher, not -ture. */
export const CHER_BANK: readonly SureTureRow[] = [
  ['tea', 'cher', 'Our tea___ read us a story.'],
  ['cat', 'cher', 'The cat___ wore a big glove.'],
  ['ri', 'cher', 'The queen was ri___ than the king.'],
  ['stret', 'cher', 'The nurse wheeled the stret___ along the hall.'],
  ['wat', 'cher', 'The bird wat___ sat very still.'],
];

const ENDINGS = ['sure', 'ture', 'sion', 'cher'];

/** d1: -sure and -ture, 2 bubbles · d2: adds -sion, 3 bubbles · d3: adds the -cher words, 4 bubbles. */
export const y4SureTure: Generator = (d, rng) => {
  const banks = d === 1 ? [SURE_BANK, TURE_BANK] : d === 2 ? [SURE_BANK, TURE_BANK, SION_BANK] : [SURE_BANK, TURE_BANK, SION_BANK, CHER_BANK];
  const [stem, ending, sentence] = pick(rng, banks.flat());
  const word = stem + ending;
  return wordQ(rng, 'Which ending is right?', ending, shuffle(rng, ENDINGS.slice(0, banks.length).filter(e => e !== ending)), {
    visual: { type: 'sentence', text: sentence },
    say: `${word}. ${sentence.replace('___', ending)}`,
    hint: 'Slice the right ending', hintIsData: false,
  });
};
