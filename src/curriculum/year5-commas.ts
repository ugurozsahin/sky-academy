// Year 5 grammar: commas to clarify meaning or avoid ambiguity (#1227). Two sentence shapes whose comma position and meaning line
// are computed from the closed lists below, never hand-labelled: ADDRESS ("Let's eat Grandma!") and WHILE ("While I was reading the cat sat down.").
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export const ADDRESSEES: readonly string[] = ['Grandma', 'Grandad', 'Mum', 'Dad', 'Jack', 'Priya', 'Sam', 'Nana', 'Ben', 'Mia'];
/** Verbs that can take a person or animal as their object: base forms, then -ing forms. */
export const OBJECT_VERBS: readonly string[] = ['eat', 'stop', 'help', 'call', 'wash', 'draw', 'paint', 'catch', 'see', 'read',
  'eating', 'stopping', 'helping', 'calling', 'washing', 'drawing', 'painting', 'catching', 'seeing', 'reading'];
export const DETERMINERS: readonly string[] = ['the', 'my', 'our', 'his', 'her'];

/** Address row: [words before the verb, verb, name, closing mark]. The comma goes straight after the verb. */
export type AddressRow = readonly [lead: string, verb: string, name: string, end: '!' | '?'];
/** While row: [subject, was|were, verb-ing, determiner, noun, rest]. The comma goes straight after the -ing word. */
export type WhileRow = readonly [subject: string, aux: string, ing: string, det: string, noun: string, rest: string];

/** d1: short address items, four words or fewer. */
export const ADDRESS_SHORT: readonly AddressRow[] = [
  ['', 'Stop', 'Jack', '!'], ["Let's", 'eat', 'Grandma', '!'], ['', 'Help', 'Mum', '!'], ['', 'Call', 'Dad', '!'], ['', 'Wash', 'Sam', '!'],
  ["Let's", 'help', 'Nana', '!'], ['Can you', 'help', 'Mum', '?'], ['Can you', 'call', 'Dad', '?'], ['Please', 'stop', 'Priya', '!'],
  ["Let's", 'call', 'Grandad', '!'], ['Please', 'help', 'Mia', '!'], ['Can you', 'stop', 'Sam', '?'], ['Please', 'call', 'Nana', '!'],
];
/** d3: longer address items, five to eight words. */
export const ADDRESS_LONG: readonly AddressRow[] = [
  ['Can you please', 'help', 'Grandad', '?'], ['Will you please', 'stop', 'Jack', '?'], ['Why are you', 'calling', 'Nana', '?'],
  ['Please do not keep', 'calling', 'Mum', '!'], ['Did you remember to', 'call', 'Priya', '?'], ['It is time to', 'stop', 'Ben', '!'],
  ['I am so glad to', 'see', 'Grandma', '!'], ['Thank you for', 'helping', 'Mum', '!'], ['Are you still', 'drawing', 'Mia', '?'],
  ['Please remember to', 'call', 'Nana', '!'], ['Are you going to', 'catch', 'Sam', '?'],
];
/** d2 (and d3 beside the long address items). */
export const WHILE_BANK: readonly WhileRow[] = [
  ['I', 'was', 'reading', 'the', 'cat', 'sat on my lap'], ['we', 'were', 'painting', 'the', 'fence', 'looked bright'],
  ['Mum', 'was', 'washing', 'the', 'baby', 'fell asleep'], ['Dad', 'was', 'drawing', 'my', 'sister', 'came in'],
  ['Sam', 'was', 'helping', 'the', 'teacher', 'cleared the tables'], ['she', 'was', 'calling', 'the', 'dog', 'barked loudly'],
  ['Jack', 'was', 'stopping', 'the', 'car', 'rolled backwards'], ['Priya', 'was', 'reading', 'her', 'sister', 'walked in'],
  ['Ben', 'was', 'painting', 'his', 'dog', 'ran across the garden'], ['they', 'were', 'helping', 'the', 'farmer', 'fed the hens'],
  ['Mia', 'was', 'drawing', 'the', 'teacher', 'walked past'], ['Nana', 'was', 'calling', 'our', 'neighbour', 'waved from the window'],
];

export const addressSentence = ([lead, verb, name, end]: AddressRow): string => `${lead ? lead + ' ' : ''}${verb} ${name}${end}`;
export const whileSentence = ([s, aux, ing, det, noun, rest]: WhileRow): string => `While ${s} ${aux} ${ing} ${det} ${noun} ${rest}.`;
export const addressMeaning = (row: AddressRow): string => `We are talking to ${row[2]}.`;
export const whileMeaning = ([, , ing, det, noun]: WhileRow): string => `Nobody was ${ing} ${det} ${noun}.`;

export const COMMA_PROMPT = 'Which word is before the comma?';
const wordsOf = (s: string): string[] => s.replace(/[!?.]$/, '').split(' ');

/** Bubbles: the answer plus decoys. d3 uses the words either side of the answer; d1 and d2 take other words of the sentence. */
function decoys(rng: Rng, sentence: string, answer: string, near: boolean): string[] {
  const ws = wordsOf(sentence), i = ws.indexOf(answer);
  const pool = near ? [ws[i - 1], ws[i + 1], ws[i + 2], ws[i - 2]] : shuffle(rng, ws);
  return [...new Set(pool.filter((w): w is string => !!w && w !== answer))];
}

function build(rng: Rng, d: Difficulty, sentence: string, answer: string, meaning: string, bubbles: number): Question {
  const ds = decoys(rng, sentence, answer, d === 3).slice(0, bubbles - 1);
  return wordQ(rng, `${COMMA_PROMPT} ${meaning}`, answer, ds, {
    visual: { type: 'sentence', text: sentence },
    say: `${meaning} ${sentence} Which word is before the comma?`, hint: 'Say it aloud: where would you pause?', hintIsData: false,
  });
}

export const y5Commas: Generator = (d: Difficulty, rng: Rng): Question => {
  if (d === 1) {
    const row = pick(rng, ADDRESS_SHORT);
    return build(rng, d, addressSentence(row), row[1], addressMeaning(row), 3);
  }
  if (d === 3 && rng() < 0.5) {
    const row = pick(rng, ADDRESS_LONG);
    return build(rng, d, addressSentence(row), row[1], addressMeaning(row), 4);
  }
  const row = pick(rng, WHILE_BANK);
  return build(rng, d, whileSentence(row), row[2], whileMeaning(row), 4);
};
