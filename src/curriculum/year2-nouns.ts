// y2-nouns (#1008): Year 2 nouns made with -er and by compounding (English Appendix 2, Year 2, Word).
// A gap card: the answer is the only option that fits the clue sentence. Every row names its decoys by hand
// (never built by code, #642/#324). -er rows: the person is the -er noun, the decoys are the same root's -ing,
// -s and past forms. Compound rows: the answer is the second word, the decoys make no real word with the first.
// Roots that keep their spelling before -er only; dance → dancer and swim → swimmer belong to y2-suffix-root.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

export type ErRow = [root: string, sentence: string, decoys: [string, string, string]];
export type CompoundRow = [first: string, second: string, sentence: string, decoys: [string, string, string]];

export const ER_BANK: ErRow[] = [
  ['teach', 'A person who teaches children at school is a ___.', ['teaching', 'teaches', 'taught']],
  ['paint', 'A person who paints pictures is a ___.', ['painting', 'paints', 'painted']],
  ['farm', 'A person who looks after a farm is a ___.', ['farming', 'farms', 'farmed']],
  ['sing', 'A person who sings songs is a ___.', ['singing', 'sings', 'sang']],
  ['play', 'A child who plays on a team is a ___.', ['playing', 'plays', 'played']],
  ['help', 'A person who helps others is a ___.', ['helping', 'helps', 'helped']],
  ['build', 'A person who builds houses is a ___.', ['building', 'builds', 'built']],
  ['clean', 'A person who cleans offices is a ___.', ['cleaning', 'cleans', 'cleaned']],
  ['work', 'A person who works in a factory is a ___.', ['working', 'works', 'worked']],
];

export const COMPOUND_BANK: CompoundRow[] = [
  ['white', 'board', 'A board you write on in class is a white___.', ['tree', 'pen', 'shoe']],
  ['super', 'man', 'A hero who can fly is a super___.', ['tree', 'pen', 'sock']],
  ['butter', 'fly', 'An insect with bright wings is a butter___.', ['shoe', 'hat', 'sock']],
  ['sand', 'castle', 'A castle you build at the beach is a sand___.', ['shoe', 'hat', 'pen']],
  ['tooth', 'brush', 'You clean your teeth with a tooth___.', ['bag', 'pan', 'hat']],
  ['pan', 'cake', 'A flat, round food cooked in a pan is a pan___.', ['bell', 'tree', 'hat']],
  ['snow', 'man', 'A man made of snow is a snow___.', ['pen', 'cup', 'sock']],
  ['bath', 'room', 'The room where you wash is the bath___.', ['tree', 'pen', 'hat']],
  ['book', 'shelf', 'A shelf for books is a book___.', ['pen', 'hat', 'cup']],
  ['post', 'box', 'You put letters in a post___.', ['tree', 'bell', 'hat']],
  ['lady', 'bird', 'A small red insect with spots is a lady___.', ['pen', 'cup', 'hat']],
  ['bus', 'stop', 'The place where you wait for a bus is a bus___.', ['tree', 'pen', 'sock']],
];

/** d1: -er nouns, 3 bubbles · d2: -er nouns, 4 bubbles · d3: -er nouns and compounds mixed, 4 bubbles. */
export const y2Nouns: Generator = (d, rng) => {
  const useCompound = d === 3 && rng() < 0.5;
  const extra = (s: string) => ({
    visual: { type: 'sentence' as const, text: s }, say: s.replace(/\s?___/, ' blank'),
    hint: useCompound ? 'Slice the word that finishes it' : 'Slice the person word', hintIsData: false,
  });
  if (useCompound) {
    const [, second, s, decoys] = pick(rng, COMPOUND_BANK);
    return wordQ(rng, s, second, shuffle(rng, decoys).slice(0, 3), extra(s));
  }
  const [root, s, decoys] = pick(rng, ER_BANK);
  return wordQ(rng, s, root + 'er', shuffle(rng, decoys).slice(0, d === 1 ? 2 : 3), extra(s));
};
