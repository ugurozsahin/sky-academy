// y6-clauses (#1281): a semicolon, colon or dash between independent clauses (English Appendix 2, Year 6 punctuation).
// d1 which mark joins two clauses (semicolon, with the comma splice as decoy) · d2 colon or dash (never two of ; : – on one
// card) or where the semicolon goes in a three-gap sentence · d3 can a semicolon go in the gap (a subordinate first clause says no).
// A full stop and a hyphen are never offered: the first could end the clause, the second looks like the dash at 13 px.
import type { Difficulty, Generator } from './types';
import { pick, shuffle, wordQ } from './util';

/** [clause A, clause B, B explains A (so a colon fits)]. Both clauses are independent and have two words or more. */
export type ClauseRow = [a: string, b: string, explains: boolean];
/** [clause A, clause B]: A is a subordinate clause, so a comma belongs at the boundary. */
export type SubRow = [a: string, b: string];

export const CLAUSE_PAIRS: ClauseRow[] = [
  ["It's raining", "I'm fed up", false],
  ['The sky was dark', 'a storm was coming', true],
  ['Tom was tired', 'he had run all day', true],
  ['The shop was shut', 'we went home', false],
  ['I love painting', 'my sister prefers music', false],
  ['The lake was frozen', 'we could not swim', false],
  ['Dad was late', 'the bus had broken down', true],
  ['She smiled', 'the day was perfect', false],
  ['The cake smelt wonderful', 'it was still hot', true],
  ['We stayed indoors', 'the wind was far too strong', true],
  ['Sam could not sleep', 'the thunder was too loud', true],
  ['Football is fun', 'chess is calm', false],
];

export const SUB_PAIRS: SubRow[] = [
  ['Although it was raining', 'we went out'],
  ['When the bell rang', 'the class lined up'],
  ['Because Mia was tired', 'she went to bed early'],
  ['If it snows tomorrow', 'we will build a snowman'],
  ['While Dad cooked', 'I laid the table'],
  ['After the film ended', 'everyone clapped'],
  ['Unless you hurry', 'you will miss the bus'],
];

const gapped = (a: string, b: string): string => `${a} _ ${b}.`;
const FLAG = 'Each clause could stand alone, so a comma is too weak to join them';

function markCard(d: Difficulty, rng: () => number) {
  const colon = d === 2 && rng() < 0.5;
  const row = colon ? pick(rng, CLAUSE_PAIRS.filter(r => r[2])) : pick(rng, CLAUSE_PAIRS);
  const answer = d === 1 ? ';' : colon ? ':' : '–';
  const decoys = d === 1 ? [',', '?'] : [',', '?', "'"];
  return wordQ(rng, 'Which mark joins these two clauses?', answer, decoys, {
    visual: { type: 'sentence', text: gapped(row[0], row[1]) },
    say: `Which punctuation mark joins these two clauses? ${row[0]}. Blank. ${row[1]}.`, hint: FLAG, hintIsData: false,
  });
}

/** The d2 position card: three gaps, one at the clause boundary. Returns the letter of the boundary gap. */
export function positionCard(rng: () => number) {
  const [a, b] = pick(rng, CLAUSE_PAIRS);
  const words = `${a} ${b}`.split(' ');
  const boundary = a.split(' ').length;
  const others = shuffle(rng, Array.from({ length: words.length - 1 }, (_, i) => i + 1).filter(g => g !== boundary)).slice(0, 2);
  const gaps = [...others, boundary].sort((x, y) => x - y);
  const text = words.map((w, i) => (gaps.includes(i) ? `[${'ABC'[gaps.indexOf(i)]}] ${w}` : w)).join(' ') + '.';
  return wordQ(rng, 'Which gap takes the semicolon?', 'ABC'[gaps.indexOf(boundary)], ['A', 'B', 'C'], {
    visual: { type: 'sentence', text }, say: `Which gap takes the semicolon? ${a}, ${b}. Pick the gap between the two clauses.`, hint: FLAG, hintIsData: false,
  });
}

function canCard(rng: () => number) {
  const yes = rng() < 0.5;
  const [a, b] = yes ? pick(rng, CLAUSE_PAIRS) : pick(rng, SUB_PAIRS);
  return wordQ(rng, 'Which is right: can a semicolon go there?', yes ? 'yes' : 'no', [yes ? 'no' : 'yes'], {
    visual: { type: 'sentence', text: gapped(a, b) }, say: `Can a semicolon go in the gap? ${a}. Blank. ${b}.`,
    hint: 'A comma belongs after a clause that cannot stand alone', hintIsData: false,
  });
}

export const y6Clauses: Generator = (d, rng) => d === 3 ? canCard(rng) : d === 2 && rng() < 0.5 ? positionCard(rng) : markCard(d, rng);
