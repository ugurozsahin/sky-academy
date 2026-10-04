// y2-conjunction (#1007): Year 2 joining words — and/or/but to co-ordinate, because/when/if/that to subordinate
// (NC English Y2 writing, statutory; Appendix 2, Year 2, Sentence). A gap card: the answer is the only listed
// word that makes the sentence sensible. Every row names its three decoys by hand, from the seven.
// The decoy test: put it in the gap — if it still reads sensibly it is not a decoy (#666). That is why a
// "because" sentence never lists "when" and a "but" sentence never lists "and": both would also fit, so the
// author leaves them out and the bubbles stay unambiguous.
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

export type Joiner = 'and' | 'or' | 'but' | 'because' | 'when' | 'if' | 'that';
export type JoinRow = [sentence: string, answer: Joiner, decoys: [Joiner, Joiner, Joiner]];

export const JOINERS: Joiner[] = ['and', 'or', 'but', 'because', 'when', 'if', 'that'];
const COORD: Joiner[] = ['and', 'or', 'but'];

export const JOIN_BANK: JoinRow[] = [
  ['I like apples ___ pears.', 'and', ['because', 'when', 'that']],
  ['We played in the park ___ ate ice cream.', 'and', ['because', 'if', 'that']],
  ['I put on my hat ___ my gloves.', 'and', ['because', 'when', 'that']],
  ['Would you like tea ___ milk?', 'or', ['because', 'when', 'that']],
  ['We can walk to school ___ go by bus.', 'or', ['because', 'that', 'when']],
  ['Is it a cat ___ a dog?', 'or', ['because', 'when', 'that']],
  ['The cake looked nice ___ it tasted bad.', 'but', ['because', 'if', 'that']],
  ['Ali is small ___ he is very fast.', 'but', ['if', 'that', 'because']],
  ['I like jam ___ I do not like honey.', 'but', ['if', 'that', 'because']],
  ['We had a picnic ___ it was sunny.', 'because', ['or', 'that', 'but']],
  ['I took an umbrella ___ it might rain.', 'because', ['or', 'but', 'that']],
  ['We were late ___ the bus broke down.', 'because', ['or', 'but', 'that']],
  ['Max smiled ___ he got a prize.', 'because', ['or', 'but', 'that']],
  ['I wave ___ I see my friend.', 'when', ['or', 'but', 'that']],
  ['We clap ___ the show ends.', 'when', ['or', 'but', 'that']],
  ['I brush my teeth ___ I wake up.', 'when', ['or', 'but', 'that']],
  ['We will go to the park ___ it is sunny.', 'if', ['or', 'but', 'that']],
  ['You can have a biscuit ___ you ask nicely.', 'if', ['or', 'but', 'that']],
  ['I will help you ___ you are stuck.', 'if', ['or', 'but', 'that']],
  ['We stay in ___ it rains.', 'if', ['or', 'but', 'that']],
  ['I know ___ the sun is a star.', 'that', ['and', 'or', 'but']],
  ['Mum said ___ it was bedtime.', 'that', ['and', 'or', 'but']],
  ['I think ___ my cat is clever.', 'that', ['and', 'or', 'but']],
  ['She told me ___ she was tired.', 'that', ['and', 'or', 'but']],
];

/** d1: and/or/but, 3 bubbles · d2: because/when/if/that, 3 bubbles · d3: any row, 4 bubbles. */
export const y2Conjunction: Generator = (d: Difficulty, rng) => {
  const rows = d === 3 ? JOIN_BANK : JOIN_BANK.filter(r => COORD.includes(r[1]) === (d === 1));
  const [s, answer, decoys] = pick(rng, rows);
  return wordQ(rng, s, answer, shuffle(rng, decoys).slice(0, d === 3 ? 3 : 2), {
    visual: { type: 'sentence', text: s }, say: s.replace('___', 'blank'), hint: 'Slice the joining word', hintIsData: false,
  });
};
