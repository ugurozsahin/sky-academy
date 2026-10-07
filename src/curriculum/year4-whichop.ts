// y4-whichop (#1172): which operation solves a one-step word problem? The four bubbles are always + − × ÷, in that
// order, so they give nothing away. `{a}` is the larger of the card's two numbers, `{b}` the smaller; the answer is
// the one operation that, applied to them, gives the story's answer. Pairs where two operations would agree are redrawn.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

export type Op = '+' | '−' | '×' | '÷';
export const OPS: readonly Op[] = ['+', '−', '×', '÷'];
/** [text, operation, trap]. `trap` names the word that points at a different operation; only d3 draws a row with one. */
export type Row = readonly [string, Op, string?];

export const PLAIN: readonly Row[] = [
  ['{a} children are on a bus. {b} more get on. How many now?', '+'],
  ['A shop sold {a} pens on Monday and {b} on Tuesday. How many?', '+'],
  ['Mia has {a} stickers and Sam has {b}. How many have they got together?', '+'],
  ['A farmer has {a} hens and {b} ducks. How many birds is that?', '+'],
  ['Mia has {a} stickers and Sam has {b}. How many more does Mia have?', '−'],
  ['A book has {a} pages. Jo has read {b}. How many pages are left?', '−'],
  ['There are {a} fans at a match and {b} go home. How many are left?', '−'],
  ['A tank holds {a} litres. {b} litres are used. How many are left?', '−'],
  ['{a} boxes have {b} pencils in each. How many pencils are there?', '×'],
  ['A tray holds {b} eggs. Ana buys {a} trays. How many eggs does she buy?', '×'],
  ['Each of {a} bags has {b} apples. How many apples are there?', '×'],
  ['A bus has {b} seats in each row and {a} rows. How many seats is that?', '×'],
  ['{a} sweets are shared equally by {b} children. How many each?', '÷'],
  ['{a} pencils go into pots of {b}. How many pots are filled?', '÷'],
  ['{a} books go into {b} equal piles. How many are in each pile?', '÷'],
  ['{a} children make teams of {b}. How many teams are there?', '÷'],
];

export const TRAPS: readonly Row[] = [
  ['Sam gave away {b} cards and has {a} left. How many at the start?', '+', 'left'],
  ['Tom is {b} cm shorter than Jo. Tom is {a} cm tall. How tall is Jo?', '+', 'shorter'],
  ['Ria lost {b} marbles and now has {a}. How many at the start?', '+', 'lost'],
  ['A jar has {a} sweets after {b} were added. How many at first?', '−', 'added'],
  ['Ben saved £{a}, which is £{b} more than Ana. How much did Ana save?', '−', 'more'],
  ['Kim has {a} stickers. {b} are new, the rest old. How many are old?', '−', 'new'],
  ['Each bag holds {b} marbles. Ana has {a}. How many bags?', '÷', 'each'],
  ['Lee has {a} cards and puts {b} in each pile. How many piles?', '÷', 'each'],
  ['{a} pens are shared out, {b} to each child. How many children?', '÷', 'each'],
  ['Each of {a} children has {b} stickers. How many are there in all?', '×', 'in all'],
  ['{a} boxes hold {b} pencils each. How many altogether?', '×', 'altogether'],
  ['Mia buys {a} packs of {b} cards each. How many cards in total?', '×', 'in total'],
];

export const apply = (op: Op, a: number, b: number): number => op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
/** The operations (larger number first) that give the same result as `op`: the card is fair only when that is just `op`. */
export const agreeing = (op: Op, a: number, b: number): Op[] => OPS.filter(o => (o !== '÷' || a % b === 0) && apply(o, a, b) === apply(op, a, b));

const FACTOR = (rng: Rng) => ri(rng, 2, 12);
/** One candidate pair, `a` the larger: × and ÷ stay within 12 × 12, + and − within 1,000 at d1 and d2, up to 9,999 at d3. */
function candidate(op: Op, d: Difficulty, rng: Rng): { a: number; b: number } {
  if (op === '÷') { const b = FACTOR(rng); return { a: b * FACTOR(rng), b }; }
  const [lo, hi] = op === '×' ? [2, 12] : d === 3 ? [1000, 9999] : d === 1 ? [20, 900] : [100, 999];
  const x = ri(rng, lo, hi), y = ri(rng, lo, hi);
  return { a: Math.max(x, y), b: Math.min(x, y) };
}

export function numbersFor(op: Op, d: Difficulty, rng: Rng): { a: number; b: number } {
  for (;;) {
    const { a, b } = candidate(op, d, rng);
    if (a === b || (op === '+' && d === 1 && a + b > 1000)) continue;
    if (agreeing(op, a, b).length === 1) return { a, b };
  }
}

const f = (n: number) => fmt(dec(n, 0));

export const y4WhichOp: Generator = (d, rng): Question => {
  const rows = d === 3 ? TRAPS : d === 1 ? PLAIN.filter(r => r[1] === '+' || r[1] === '−') : PLAIN;
  for (;;) {
    const [text, op] = pick(rng, rows);
    const { a, b } = numbersFor(op, d, rng);
    const prompt = text.replace('{a}', f(a)).replace('{b}', f(b));
    if (prompt.length > 72) continue; // three lines at 390 px (#1051)
    const card = wordQ(rng, prompt, op, OPS.filter(o => o !== op), { say: ks2Say(`${prompt} Which operation solves it?`), hint: 'Which operation solves it?', hintIsData: false });
    return { ...card, options: [...OPS], wide: false };
  }
};
