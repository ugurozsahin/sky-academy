// y3-column (#1084): formal column addition and subtraction to 3 digits. d1–d2 build the answer digit by digit
// (`buildQ`, the sum stays on the card); d3 finds one missing digit among four single-digit options.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, q } from './util';
import { buildQ } from './build';

const MINUS = '−';
const TOTAL = 7;
const digitsOf = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
/** Columns (units, tens, hundreds) of `a + b` that pass a carry on, and of `a − b` that borrow. */
const carries = (a: number, b: number) => [10, 100, 1000].filter(m => a % m + b % m >= m).length;
/** Exchanges made by the units and tens columns alone (the carry into the thousands is not one). */
const lowerCarries = (a: number, b: number) => [10, 100].filter(m => a % m + b % m >= m).length;
const borrows = (a: number, b: number) => [0, 1, 2].filter(i => a % 10 ** (i + 1) < b % 10 ** (i + 1)).length;
const withComma = (n: number) => n >= 1000 ? `${Math.floor(n / 1000)},${String(n % 1000).padStart(3, '0')}` : String(n);

/** Does (a, b) fit `d`? d1: at most one exchange (3-digit − 2-digit: none); d2: units and tens both exchange (sums reach 1,998), or a subtraction with one or more. */
function fits(d: 1 | 2, add: boolean, a: number, b: number, rng: Rng): boolean {
  if (add) return d === 1 ? carries(a, b) <= 1 && a + b <= 999 : lowerCarries(a, b) === 2 && (a + b >= 1000 || rng() < 0.5);
  if (a - b < 10) return false;
  // d2 includes borrowing across a zero (503 − 178) about half the time.
  return d === 1 ? borrows(a, b) === 0 : borrows(a, b) >= 1 && (rng() < 0.5 ? digitsOf(a)[1] === 0 : true);
}

function draw(d: 1 | 2, add: boolean, rng: Rng): { a: number; b: number } {
  for (let i = 0; i < 500; i++) {
    const a = ri(rng, 100, 999);
    const b = add ? ri(rng, 100, 999) : d === 1 ? ri(rng, 10, 99) : ri(rng, 100, 899);
    if (fits(d, add, a, b, rng)) return { a, b };
  }
  return d === 1 ? (add ? { a: 214, b: 345 } : { a: 587, b: 34 }) : (add ? { a: 678, b: 457 } : { a: 503, b: 178 });
}

/** d3: one digit of the first number hidden; the options are its digit, a ±1 slip and the exchange-less column digit. */
function missing(rng: Rng): Question {
  const add = rng() < 0.5;
  const a = ri(rng, 100, 899);
  const b = ri(rng, 100, add ? 999 - a : 899);
  const result = add ? a + b : a - b;
  if (result < 100) return missing(rng);
  const pos = ri(rng, 0, 2);
  const truth = digitsOf(a)[pos];
  const other = digitsOf(result)[pos], bd = digitsOf(b)[pos];
  const slips = [truth - 1, truth + 1, Math.abs(other - bd)].filter(v => v >= 0 && v <= 9 && v !== truth);
  const wrong = [...new Set([...shuffle(rng, slips), ...shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => v !== truth))])].filter(v => v !== truth).slice(0, 3);
  const shown = digitsOf(a).map((x, i) => i === pos ? '_' : x).join('');
  const prompt = `Missing digit: ${shown} ${add ? '+' : MINUS} ${b} = ${result}`;
  const spoken = digitsOf(a).map((x, i) => i === pos ? 'missing digit' : x).join(', ');
  const say = `${spoken}, ${add ? 'plus' : 'minus'} ${b}, equals ${result}. Which digit is missing?`;
  return { prompt, say, answer: String(truth), options: shuffle(rng, [truth, ...wrong].map(String)), slow: true };
}

export const y3Column: Generator = (d: Difficulty, rng): Question => {
  if (d === 3) return missing(rng);
  const add = rng() < 0.5;
  const { a, b } = draw(d, add, rng);
  const sum = `${a} ${add ? '+' : MINUS} ${b} = ?`;
  const answer = withComma(add ? a + b : a - b);
  return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer.`, answer, total: TOTAL, hint: 'Slice the digits in order' });
};
