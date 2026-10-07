// y4-plural-poss (#1163): where the apostrophe goes — girl's, girls', children's (English Appendix 2, Year 4). The card
// says whose bikes they are ("one boy" or "two boys") and the child slices the one correct form of the owner. At d3 half
// the cards ask for a plain plural before a verb instead, where no possessive is grammatical.
import type { Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** One bank row: the singular owner, its plural, and the thing owned. No plural equals its singular, none ends in s. */
export type PossRow = readonly [singular: string, plural: string, owned: string];

export const REGULAR_BANK: readonly PossRow[] = [
  ['girl', 'girls', 'names'], ['boy', 'boys', 'bikes'], ['dog', 'dogs', 'bowls'], ['teacher', 'teachers', 'desks'],
  ['baby', 'babies', 'toys'], ['fox', 'foxes', 'den'], ['horse', 'horses', 'tails'],
];
export const IRREGULAR_BANK: readonly PossRow[] = [
  ['child', 'children', 'books'], ['man', 'men', 'hats'], ['woman', 'women', 'coats'], ['mouse', 'mice', 'tails'], ['person', 'people', 'votes'],
];
/** The d3 sentence form: the gap is always followed by a verb, so only the plain plural is grammatical. */
export const VERB_FRAMES: readonly string[] = [
  'The ___ are playing football.', 'The ___ were very tired.', 'The ___ have gone home.', 'The ___ are waiting outside.',
];

/** d1: regular owners, one or many · d2: adds the irregular plurals · d3: half the cards are the plain-plural sentence form. */
export const y4PluralPoss: Generator = (d, rng) => {
  const sentence = d === 3 && rng() < 0.5;
  const [one, many, owned] = pick(rng, d === 1 ? REGULAR_BANK : [...REGULAR_BANK, ...IRREGULAR_BANK]);
  const regular = many.endsWith('s');
  if (sentence) {
    const text = pick(rng, VERB_FRAMES);
    const wrong = regular ? [many + "'", one + "'s"] : [many + "'s", many + "s'"];
    return wordQ(rng, 'Which word fits the gap?', many, wrong, {
      visual: { type: 'sentence', text: text },
      say: text.replace('___', 'blank'), hint: 'A plain plural, or does it own something?', hintIsData: false,
    });
  }
  const plural = rng() < 0.5;
  const answer = plural ? (regular ? many + "'" : many + "'s") : one + "'s";
  const otherPoss = plural ? one + "'s" : (regular ? many + "'" : many + "'s");
  const slip = pick(rng, [many, regular ? many + "'s" : many + "s'"]);
  const text = `the ${owned} of ${plural ? 'two' : 'one'} ${plural ? many : one}: the ___ ${owned}`;
  return wordQ(rng, 'Which is right?', answer, shuffle(rng, [otherPoss, slip]), {
    visual: { type: 'sentence', text },
    say: `The ${owned} of ${plural ? 'two' : 'one'} ${plural ? many : one}. The blank ${owned}. Where does the apostrophe go?`,
    hint: 'One owner or many? Where does the apostrophe go?', hintIsData: false,
  });
};
