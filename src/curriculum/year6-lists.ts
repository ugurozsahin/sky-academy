// y6-lists (#1282): lists and bullet points (English Appendix 2 Y6 punctuation). d1 a colon after a complete clause introduces a list ·
// d2 a semicolon separates list items that hold their own commas · d3 which bullet is punctuated differently. Every answer is computed
// from the data. The comma is the misconception decoy on d1–d2; no option is ever a dash (a dash can introduce a list informally).
import type { Generator, Question } from './types';
import { pick, shuffle, wordQ } from './util';

/** [complete main clause, items]; a colon is right after the clause. */
export const LIST_INTROS: readonly (readonly [string, readonly string[]])[] = [
  ['You will need three things', ['a pen', 'a ruler', 'a rubber']],
  ['We packed for the beach', ['a towel', 'a bucket', 'a spade', 'a hat']],
  ['Mum bought some fruit', ['apples', 'pears', 'grapes']],
  ['The farm has four animals', ['a cow', 'a pig', 'a goat', 'a hen']],
  ['Our class has three pets', ['a rabbit', 'a gerbil', 'a fish']],
  ['Bring these to school', ['your coat', 'your book', 'your lunch']],
  ['The shop sells three colours', ['red', 'green', 'yellow']],
  ['We made a picnic', ['sandwiches', 'crisps', 'cake', 'juice']],
  ['There are three seasons I like', ['spring', 'summer', 'autumn']],
  ['Dad grew some vegetables', ['peas', 'carrots', 'leeks']],
  ['The museum has three rooms', ['the Roman room', 'the Viking room', 'the Tudor room']],
];

/** [complete main clause, three items that each hold a comma]; the items are split by semicolons. */
export const COMMA_ITEMS: readonly (readonly [string, readonly string[]])[] = [
  ['We visited three cities', ['Paris, France', 'Rome, Italy', 'Oslo, Norway']],
  ['The team has three members', ['Sam, the captain', 'Ria, the goalkeeper', 'Jo, the striker']],
  ['She keeps three pets', ['Bella, a spaniel', 'Mo, a hamster', 'Pip, a parrot']],
  ['The class met three helpers', ['Mr Khan, the caretaker', 'Mrs Lee, the cook', 'Miss Ali, the nurse']],
  ['Our trip had three stops', ['York, in the morning', 'Leeds, at lunch', 'Hull, at tea time']],
  ['I packed three snacks', ['grapes, washed', 'toast, buttered', 'cheese, sliced']],
  ['Dad named three rivers', ['the Thames, in London', 'the Severn, in Wales', 'the Tyne, in the north']],
  ['The poster shows three dates', ['Monday, the first', 'Tuesday, the second', 'Friday, the fifth']],
];

/** Item triples; each item is at most 7 letters so that "A drink." still fits a bubble label. */
export const BULLETS: readonly (readonly [string, string, string])[] = [
  ['a torch', 'a map', 'a drink'], ['a pen', 'a ruler', 'a book'], ['a hat', 'a coat', 'a scarf'],
  ['milk', 'bread', 'eggs'], ['a kite', 'a ball', 'a rope'], ['paint', 'glue', 'paper'],
  ['a spade', 'a pail', 'a net'], ['rice', 'beans', 'peas'], ['a cup', 'a plate', 'a bowl'],
];

const joinList = (items: readonly string[]): string => `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
const SAY = 'Which punctuation mark goes in the gap?';
const HINT = 'Look at the clause before the gap and at the list after it.';

function colon(rng: () => number): Question {
  const [clause, items] = pick(rng, LIST_INTROS);
  const text = `${clause} _ ${joinList(items)}.`;
  return wordQ(rng, SAY, ':', [',', ';'], { visual: { type: 'sentence', text }, say: `${text.replace('_', 'blank')} ${SAY}`, hint: HINT, hintIsData: false });
}

function semicolon(rng: () => number): Question {
  const [clause, [a, b, c]] = pick(rng, COMMA_ITEMS);
  const text = `${clause}: ${a} _ ${b}; and ${c}.`;
  return wordQ(rng, SAY, ';', [',', ':'], { visual: { type: 'sentence', text }, say: `${text.replace('_', 'blank')} ${SAY}`, hint: HINT, hintIsData: false });
}

/** The (first letter is a capital, ends with a full stop) signature the d3 oracle compares. */
export const bulletStyle = (s: string): string => `${/^[A-Z]/.test(s)}/${s.endsWith('.')}`;

function bullets(rng: () => number): Question {
  const items = shuffle(rng, pick(rng, BULLETS));
  const capital = rng() < 0.5, flipCase = rng() < 0.5, odd = Math.floor(rng() * 3);
  const shown = items.map((s, i) => {
    const flip = i === odd;
    const cap = capital !== (flip && flipCase);
    const stop = capital !== (flip && !flipCase);
    return (cap ? s[0].toUpperCase() + s.slice(1) : s) + (stop ? '.' : '');
  });
  const prompt = 'Which bullet point is punctuated differently?';
  return wordQ(rng, prompt, shown[odd], shown.filter((_, i) => i !== odd), {
    visual: { type: 'sentence', text: shown.map(s => `• ${s}`).join('   ') }, say: `${prompt} ${shown.join('. ')}`,
    hint: 'Two bullet points are punctuated the same way.', hintIsData: false,
  });
}

/** d1: colon before a list · d2: semicolons between items with commas · d3: the odd bullet out. */
export const y6Lists: Generator = (d, rng) => d === 1 ? colon(rng) : d === 2 ? semicolon(rng) : bullets(rng);
