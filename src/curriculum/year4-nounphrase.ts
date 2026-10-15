// y4-nounphrase (#1165): expanded noun phrases (English Appendix 2, Year 4 — "the teacher" expanded to "the strict maths
// teacher with curly hair"). d1 picks the modifier that fits a gap, d2 spots the expanded noun phrase among three lettered
// lines, d3 finds the head noun inside a long phrase. A phrase never sits in a bubble: d2 answers with a letter.
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** d1: [determiner, head noun, the modifier that fits]. The modifier is an adjective or a noun used as a modifier. */
export type GapRow = readonly [det: string, head: string, modifier: string];
export const GAP_BANK: readonly GapRow[] = [
  ['the', 'dog', 'fluffy'], ['a', 'cat', 'black'], ['the', 'tree', 'tall'], ['my', 'bag', 'heavy'], ['the', 'cake', 'chocolate'],
  ['a', 'gate', 'wooden'], ['the', 'road', 'long'], ['a', 'boy', 'kind'], ['the', 'girl', 'clever'], ['a', 'bird', 'tiny'],
  ['the', 'sky', 'dark'], ['my', 'book', 'old'], ['the', 'gate', 'farm'], ['a', 'bag', 'school'],
];

/** d1 decoys. Irregular simple-past verbs (not the participle, so "the ran dog" can never be read), and -ly adverbs made from an adjective. */
export const VERB_DECOYS = ['ran', 'went', 'ate', 'sang', 'swam', 'drank', 'grew', 'flew'] as const;
export const ADVERB_DECOYS = ['quickly', 'slowly', 'loudly', 'gently', 'happily'] as const;

/** d2: an expanded noun phrase [determiner, modifiers, head noun, optional preposition phrase]. */
export type PhraseRow = readonly [det: string, mods: readonly string[], head: string, pp?: readonly [prep: string, det: string, noun: string]];
export const NP_BANK: readonly PhraseRow[] = [
  ['the', ['old'], 'man', ['with', 'a', 'stick']], ['the', ['big', 'red'], 'bus'], ['a', ['tiny', 'green'], 'frog'],
  ['the', ['shiny', 'new'], 'coin'], ['my', ['funny', 'little'], 'brother'], ['the', ['tall'], 'girl', ['with', 'a', 'hat']],
  ['a', ['hungry', 'brown'], 'bear'], ['the', ['cold', 'winter'], 'wind'], ['a', ['juicy', 'red'], 'apple'],
  ['the', ['small'], 'boy', ['with', 'a', 'kite']], ['our', ['noisy', 'football'], 'team'], ['the', ['little'], 'dog', ['in', 'the', 'garden']],
];

/** d2: a verb phrase whose noun has only a determiner before it. */
export const VP_BANK: readonly string[] = [
  'ran to the shop', 'ate the cake', 'kicked the ball', 'opened the door', 'found a coin', 'climbed the hill',
  'read a book', 'fed the ducks', 'painted a picture', 'cleaned the room', 'watched the film', 'jumped over the wall',
];

/** d2: an adverbial with no noun in it. */
export const ADV_BANK: readonly string[] = [
  'very quickly', 'very slowly', 'quite loudly', 'really fast', 'ever so gently', 'much later',
  'so happily', 'far away', 'very carefully', 'quite suddenly', 'rather quietly', 'very soon',
];

/** d3: [determiner, adjectives, noun modifier, head noun, preposition phrase]. Every phrase has all four parts. */
export type HeadRow = readonly [det: string, adjs: readonly string[], nounMod: string, head: string, pp: readonly [prep: string, det: string, noun: string]];
export const HEAD_BANK: readonly HeadRow[] = [
  ['the', ['strict'], 'maths', 'teacher', ['with', 'a', 'beard']], ['a', ['small'], 'garden', 'gate', ['with', 'a', 'lock']],
  ['the', ['happy'], 'football', 'fan', ['in', 'the', 'stand']], ['an', ['old'], 'stone', 'bridge', ['over', 'the', 'river']],
  ['the', ['new'], 'school', 'bus', ['with', 'a', 'flag']], ['a', ['tasty'], 'cheese', 'sandwich', ['with', 'some', 'pickle']],
  ['the', ['little'], 'birthday', 'cake', ['on', 'the', 'table']], ['my', ['kind'], 'history', 'teacher', ['at', 'the', 'school']],
  ['the', ['tall'], 'office', 'block', ['near', 'the', 'park']], ['a', ['bright'], 'garden', 'lamp', ['by', 'the', 'door']],
  ['the', ['busy'], 'city', 'street', ['with', 'a', 'bakery']], ['the', ['quiet'], 'village', 'shop', ['on', 'the', 'corner']],
  ['a', ['tiny'], 'paper', 'boat', ['on', 'the', 'pond']], ['the', ['friendly'], 'dinner', 'lady', ['from', 'the', 'hall']],
];

const LETTERS = ['A', 'B', 'C'];
const NP_PROMPT = 'Which is an expanded noun phrase?';

export const phraseText = (r: PhraseRow): string => [r[0], ...r[1], r[2], ...(r[3] ?? [])].join(' ');
export const headText = (r: HeadRow): string => [r[0], ...r[1], r[2], r[3], ...r[4]].join(' ');

/** d1: choose the modifier. The decoys are a verb and an adverb, neither of which can sit before a noun. */
function gap(rng: () => number): Question {
  const [det, head, mod] = pick(rng, GAP_BANK);
  const text = `${det} ___ ${head}`;
  const prompt = 'Which word fits the gap to expand the noun phrase?';
  return wordQ(rng, prompt, mod, [pick(rng, VERB_DECOYS), pick(rng, ADVERB_DECOYS)], {
    visual: { type: 'sentence', text }, say: `${text.replace('___', 'blank')}. ${prompt}`, wide: true,
    hint: 'A word that describes the noun goes in the gap.', hintIsData: false,
  });
}

/** d2: one expanded noun phrase, one verb phrase, one adverbial, in a shuffled order on lettered lines. */
function spot(rng: () => number): Question {
  const np = phraseText(pick(rng, NP_BANK));
  const lines = shuffle(rng, [np, pick(rng, VP_BANK), pick(rng, ADV_BANK)]);
  const answer = LETTERS[lines.indexOf(np)];
  return wordQ(rng, NP_PROMPT, answer, LETTERS.filter(l => l !== answer), {
    visual: { type: 'sentence', text: lines.map((l, i) => `${LETTERS[i]}: ${l}`).join('\n') }, say: `${NP_PROMPT} ${lines.map((l, i) => `${LETTERS[i]}, ${l}`).join('. ')}`,
    hint: 'An expanded noun phrase has a noun with describing words around it.', hintIsData: false,
  });
}

/** d3: the head noun. The decoys are the noun modifier (the first noun), the noun inside the preposition phrase (the last noun) and an adjective. */
function head(rng: () => number): Question {
  const row = pick(rng, HEAD_BANK), text = headText(row);
  const prompt = 'Which word is the main noun?';
  return wordQ(rng, prompt, row[3], [row[2], row[4][2], row[1][0]], {
    visual: { type: 'sentence', text }, say: `${text}. ${prompt}`, wide: true,
    hint: 'The main noun is the one the whole phrase is about.', hintIsData: false,
  });
}

/** d1: pick the modifier for a gap · d2: spot the expanded noun phrase · d3: find the head noun of a long phrase. */
export const y4NounPhrase: Generator = (d, rng) => (d === 1 ? gap(rng) : d === 2 ? spot(rng) : head(rng));
