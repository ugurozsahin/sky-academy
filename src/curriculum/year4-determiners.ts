// y4-determiners (#1169): determiner, pronoun and possessive pronoun (English Appendix 2, Year 4 terminology). d1 finds the determiner,
// d2 the possessive pronoun (a determiner is always among the decoys), d3 names the class of "their" or "theirs" in its sentence.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** D determiner (this, a, their…), P possessive pronoun (mine, theirs…), N noun, V verb, A adjective. */
export type Cls = 'D' | 'P' | 'N' | 'V' | 'A';
/** [sentence, the words it offers as options → their class]. */
export type Row = readonly [text: string, words: Readonly<Record<string, Cls>>];

/** d1: exactly one determiner in the sentence; the other three offered words are a noun, a verb and an adjective. */
export const DET_BANK: readonly Row[] = [
  ['The happy dog ran home.', { The: 'D', happy: 'A', dog: 'N', ran: 'V' }],
  ['My noisy cat sleeps all day.', { My: 'D', noisy: 'A', cat: 'N', sleeps: 'V' }],
  ['We ate some tasty cake.', { some: 'D', tasty: 'A', cake: 'N', ate: 'V' }],
  ['Every tall boy jumped.', { Every: 'D', tall: 'A', boy: 'N', jumped: 'V' }],
  ['Those red kites flew high.', { Those: 'D', red: 'A', kites: 'N', flew: 'V' }],
  ['I opened an old box.', { an: 'D', old: 'A', box: 'N', opened: 'V' }],
  ['Your clever sister sang loudly.', { Your: 'D', clever: 'A', sister: 'N', sang: 'V' }],
  ['Their new puppy digs holes.', { Their: 'D', new: 'A', puppy: 'N', digs: 'V' }],
  ['This big tree grows fast.', { This: 'D', big: 'A', tree: 'N', grows: 'V' }],
  ['These soft pillows feel lovely.', { These: 'D', soft: 'A', pillows: 'N', feel: 'V' }],
  ['A hungry fox hid.', { A: 'D', hungry: 'A', fox: 'N', hid: 'V' }],
  ['Mum baked that huge pie.', { that: 'D', huge: 'A', pie: 'N', baked: 'V' }],
];

/** d2: one possessive pronoun; every row offers a determiner (a possessive one in some), the rest a noun, a verb or an adjective. */
export const POSS_BANK: readonly Row[] = [
  ['That bike is mine.', { mine: 'P', That: 'D', bike: 'N', is: 'V' }],
  ['My coat is red but yours is blue.', { yours: 'P', My: 'D', coat: 'N', red: 'A' }],
  ['Our dog is bigger than theirs.', { theirs: 'P', Our: 'D', dog: 'N', bigger: 'A' }],
  ['This seat is hers.', { hers: 'P', This: 'D', seat: 'N', is: 'V' }],
  ['Those pencils are ours.', { ours: 'P', Those: 'D', pencils: 'N', are: 'V' }],
  ['Your hat is wet but mine is dry.', { mine: 'P', Your: 'D', hat: 'N', wet: 'A' }],
  ['These shoes are yours.', { yours: 'P', These: 'D', shoes: 'N', are: 'V' }],
  ['Their house is old, but ours is new.', { ours: 'P', Their: 'D', house: 'N', old: 'A' }],
  ['That red bag is ours, but my bag is blue.', { ours: 'P', That: 'D', my: 'D', bag: 'N' }],
];

/** d3 twins: [sentence with the determiner, its word, sentence with the possessive pronoun, its word]. */
export type Twin = readonly [det: string, detWord: string, pron: string, pronWord: string];
export const TWINS: readonly Twin[] = [
  ['Their coats are wet.', 'Their', 'The coats are theirs.', 'theirs'],
  ['My bike is new.', 'My', 'The bike is mine.', 'mine'],
  ['Is your bag here?', 'your', 'Is the bag yours?', 'yours'],
  ['Our house is big.', 'Our', 'The house is ours.', 'ours'],
  ['My pencil is sharp.', 'My', 'The pencil is mine.', 'mine'],
  ['Their team won.', 'Their', 'The prize is theirs.', 'theirs'],
];

const TERMS = ['determiner', 'pronoun', 'noun', 'adjective'];

function find(rng: () => number, bank: readonly Row[], prompt: string, want: Cls, bubbles: number, wide: boolean, hint: string): Question {
  const [text, words] = pick(rng, bank);
  const answer = Object.keys(words).find(w => words[w] === want)!;
  // Every determiner in the row is offered first (a possessive one is the trap for a possessive pronoun), then the rest.
  const dets = Object.keys(words).filter(w => words[w] === 'D' && w !== answer);
  const rest = shuffle(rng, Object.keys(words).filter(w => w !== answer && !dets.includes(w)));
  const decoys = [...dets, ...rest].slice(0, bubbles - 1);
  return wordQ(rng, prompt, answer, decoys, { visual: { type: 'sentence', text }, say: `${text} ${prompt}`, wide, hint, hintIsData: false });
}

function term(rng: () => number): Question {
  const [det, dw, pron, pw] = pick(rng, TWINS);
  const isDet = rng() < 0.5, text = isDet ? det : pron, w = isDet ? dw : pw;
  const prompt = `Which kind of word is "${w}" here?`;
  return wordQ(rng, prompt, isDet ? 'determiner' : 'pronoun', TERMS.filter(t => t !== (isDet ? 'determiner' : 'pronoun')), {
    visual: { type: 'sentence', text }, say: `${text} ${prompt}`, wide: true,
    hint: 'A determiner comes before a noun. A possessive pronoun stands on its own.', hintIsData: false,
  });
}

/** d1: the determiner among a noun, a verb and an adjective · d2: the possessive pronoun · d3: the term for "their" or "theirs". */
export const y4Determiners: Generator = (d, rng) => {
  if (d === 1) return find(rng, DET_BANK, 'Which word is the determiner?', 'D', 4, true, 'A determiner comes before a noun, like the, a, this or my.');
  if (d === 2) return find(rng, POSS_BANK, 'Which word is the possessive pronoun?', 'P', 4, false, 'A possessive pronoun stands on its own, like mine or theirs.');
  return term(rng);
};
