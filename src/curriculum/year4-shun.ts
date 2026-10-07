// y4-shun (#1161): the /ʃən/ endings of English Appendix 1, Years 3–4 — the root word's last letters say whether it is
// -tion, -ssion, -sion or -cian. The child hears the word, sees it in a gap sentence with the stem written out and slices
// the ending; from d2 the root word is the clue. Every wrong ending makes an invented non-word.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** One bank row: the stem, the ending that completes it, the root word and a sentence with `___` where the ending goes. */
export type ShunRow = readonly [stem: string, ending: string, root: string, sentence: string];

export const TION_BANK: readonly ShunRow[] = [
  ['inven', 'tion', 'invent', 'The inven___ of the wheel changed the world.'],
  ['injec', 'tion', 'inject', 'The nurse gave me an injec___ in my arm.'],
  ['ac', 'tion', 'act', 'The film was full of ac___.'],
  ['collec', 'tion', 'collect', 'I added a shell to my collec___.'],
  ['comple', 'tion', 'complete', 'The comple___ of the puzzle took an hour.'],
];
/** The two exceptions: the root ends in d, but the ending is -tion. */
export const EXCEPTION_BANK: readonly ShunRow[] = [
  ['atten', 'tion', 'attend', 'Please pay atten___ to the teacher.'],
  ['inten', 'tion', 'intend', 'It was my inten___ to tidy my room.'],
];
export const SSION_BANK: readonly ShunRow[] = [
  ['expre', 'ssion', 'express', 'He had a happy expre___ on his face.'],
  ['discu', 'ssion', 'discuss', 'We had a long discu___ about pets.'],
  ['confe', 'ssion', 'confess', 'The fox made a confe___ about the missing pie.'],
  ['permi', 'ssion', 'permit', 'I asked for permi___ to go out.'],
  ['admi', 'ssion', 'admit', 'The admi___ price to the zoo is five pounds.'],
];
export const SION_BANK: readonly ShunRow[] = [
  ['expan', 'sion', 'expand', 'The expan___ of the town made it much bigger.'],
  ['exten', 'sion', 'extend', 'Dad built an exten___ onto the house.'],
  ['comprehen', 'sion', 'comprehend', 'We did a reading comprehen___ test.'],
  ['ten', 'sion', 'tense', 'There was ten___ in the room before the race.'],
];
export const CIAN_BANK: readonly ShunRow[] = [
  ['musi', 'cian', 'music', 'My uncle is a musi___ in a band.'],
  ['electri', 'cian', 'electric', 'The electri___ fixed the lights.'],
  ['magi', 'cian', 'magic', 'The magi___ pulled a rabbit from a hat.'],
  ['politi', 'cian', 'politics', 'The politi___ gave a speech.'],
];

const ENDINGS = ['tion', 'sion', 'ssion', 'cian'];

/** d1: -tion and -cian, no root, 2 bubbles · d2: the root is the clue, all four endings · d3: adds the two exceptions. */
export const y4Shun: Generator = (d, rng) => {
  const banks = d === 1 ? [TION_BANK, CIAN_BANK] : d === 2 ? [TION_BANK, SSION_BANK, SION_BANK, CIAN_BANK] : [TION_BANK, EXCEPTION_BANK, SSION_BANK, SION_BANK, CIAN_BANK];
  const [stem, ending, root, sentence] = pick(rng, banks.flat());
  const word = stem + ending;
  const options = d === 1 ? ['tion', 'cian'] : ENDINGS;
  return wordQ(rng, d === 1 ? 'Which ending is right?' : `Root word: ${root}. Which ending is right?`, ending, shuffle(rng, options.filter(e => e !== ending)), {
    visual: { type: 'sentence', text: sentence },
    say: `${word}. ${sentence.replace('___', ending)}`,
    hint: 'Slice the right ending', hintIsData: false,
  });
};
