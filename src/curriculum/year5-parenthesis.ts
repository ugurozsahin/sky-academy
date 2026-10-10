// Year 5 grammar: brackets, dashes or commas to indicate parenthesis (#1226). Each bank row is [before, inside, rest];
// the sentence is built with one pair of marks around `inside`, so the oracle is computed, never hand-labelled.
import type { Difficulty, Generator, Question, Rng } from './types';
import { pick, shuffle, wordQ } from './util';

export type Kind = 'bracket' | 'comma' | 'dash';
export type Row = readonly [before: string, inside: string, rest: string];

export const BANK: readonly Row[] = [
  ['My dog', 'a spaniel', ' loves long walks.'], ['Our teacher', 'Mrs Khan', ' loves maths.'],
  ['The castle', 'built long ago', ' is still standing.'], ['My brother', 'who is ten', ' plays football.'],
  ['The bus', 'which was late', ' stopped outside school.'], ['Grandad', 'my favourite person', ' bakes brilliant cakes.'],
  ['The park', 'near our house', ' has a big slide.'], ['Our cat', 'Ginger', ' sleeps all day.'],
  ['The museum', 'open until five', ' has a whale skeleton.'], ['My sister', 'a good swimmer', ' won the race.'],
  ['The lake', 'frozen in winter', ' looks like glass.'], ['Our class', 'all thirty of us', ' went to the zoo.'],
  ['The shop', 'on the corner', ' sells sweets.'], ['Mum', 'a very fast driver', ' arrived early.'],
  ['The train', 'an old steam engine', ' puffed up the hill.'], ['My friend Sam', 'who loves chess', ' plays every day.'],
  ['The moon', 'bright and round', ' lit the garden.'], ['Our teacher', 'Mr Jones', ' reads us stories.'],
  ['The farmer', 'up before dawn', ' fed the hens.'], ['The cake', 'chocolate with cream', ' was gone in a minute.'],
  ['Dad', 'after a long day', ' cooked tea.'], ['The tower', 'tall and thin', ' swayed in the wind.'],
  ['My cousin', 'who lives in Wales', ' visits every summer.'], ['The river', 'wide and slow', ' runs past the village.'],
  ['Our headteacher', 'Mrs Patel', ' opened the new library.'], ['The robot', 'built by my uncle', ' can dance.'],
  ['A rabbit', 'small and brown', ' hopped across the lawn.'], ['The match', 'played in the rain', ' ended in a draw.'],
];

export const DASH = '–'; // spaced en dash, U+2013 (never an ASCII hyphen)
export const KINDS: readonly Kind[] = ['bracket', 'comma', 'dash'];
const MARKS: Record<Kind, readonly [string, string]> = { bracket: ['(', ')'], comma: [',', ','], dash: [DASH, DASH] };

/** The sentence as [text before the opening mark, opening mark, text between, closing mark, text after]. */
function pieces([before, inside, rest]: Row, kind: Kind): [string, string, string, string, string] {
  const [open, close] = MARKS[kind];
  if (kind === 'bracket') return [`${before} `, open, inside, close, rest];
  if (kind === 'comma') return [before, open, ` ${inside}`, close, rest];
  return [`${before} `, open, ` ${inside} `, close, rest];
}

/** The full sentence with its parenthesis fenced off by a pair of the given kind. */
export const build = (row: Row, kind: Kind): string => pieces(row, kind).join('');

/** The same sentence with one mark of the pair replaced by `_`; `side` picks which half is missing. */
export function gapped(row: Row, kind: Kind, side: 'open' | 'close'): string {
  const [a, o, m, c, z] = pieces(row, kind);
  return side === 'open' ? `${a}_${m}${c}${z}` : `${a}${o}${m}_${z}`;
}

/** Plain sentence for the speech engine: the marks are never read aloud. */
const spoken = ([b, i, r]: Row): string => `${b} ${i}${r}`;

const wordsOf = (s: string): string[] => s.match(/[A-Za-z0-9]+/g) ?? [];
/** Words of `text` that occur exactly once in `whole` (case-insensitive), 3–9 characters. */
export function uniqueWords(text: string, whole: string): string[] {
  const all = wordsOf(whole).map(w => w.toLowerCase());
  return [...new Set(wordsOf(text))].filter(w => w.length >= 3 && w.length <= 9 && all.filter(x => x === w.toLowerCase()).length === 1);
}

const MARK_BUBBLES = { 1: ['(', ')', '.'], 2: ['(', ')', ',', DASH] } as const;

function missingCard(d: 1 | 2, rng: Rng): Question {
  const row = pick(rng, BANK);
  const kind: Kind = d === 1 ? 'bracket' : pick(rng, KINDS);
  const side = rng() < 0.5 ? 'open' : 'close';
  const [open, close] = MARKS[kind];
  const answer = side === 'open' ? open : close; // the mark the child slices is the one the `_` replaced
  return wordQ(rng, 'Which mark is missing?', answer, [...MARK_BUBBLES[d]], {
    visual: { type: 'sentence', text: gapped(row, kind, side) },
    say: `${spoken(row)} Which punctuation mark is missing?`, hint: 'Marks come in pairs.', hintIsData: false,
  });
}

function insideCard(rng: Rng): Question {
  const row = pick(rng, BANK), kind = pick(rng, KINDS);
  const text = build(row, kind), [before, inside, rest] = row;
  const answer = pick(rng, uniqueWords(inside, text));
  const outside = shuffle(rng, uniqueWords(before + rest, text).filter(w => w !== answer)).slice(0, 3);
  return wordQ(rng, 'Which word is inside the parenthesis?', answer, outside, {
    visual: { type: 'sentence', text }, say: `${spoken(row)} Which word is inside the parenthesis?`,
    hint: 'It sits between the pair.', hintIsData: false,
  });
}

export const y5Parenthesis: Generator = (d: Difficulty, rng: Rng): Question => (d === 3 ? insideCard(rng) : missingCard(d, rng));
