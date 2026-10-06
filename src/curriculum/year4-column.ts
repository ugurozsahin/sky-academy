// y4-column (#1136): column addition and subtraction to 4 digits. Build cards keep the sum on the card and the child slices
// the answer's digits (`_,___`, six bubbles); d3 adds inverse checks ("5,236 − 1,478 = 3,758. Check: 3,758 + 1,478 = ?").
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';

const MINUS = '−';
const f = (n: number) => fmt(dec(n, 0));
/** Columns (units, tens, hundreds) that pass a carry on when adding. */
export const carries = (a: number, b: number) => [10, 100, 1000].filter(m => a % m + b % m >= m).length;
/** Columns (units, tens, hundreds) that borrow when subtracting b from a. */
export const borrows = (a: number, b: number) => [10, 100, 1000].filter(m => a % m < b % m).length;

/** A 4-digit-answer calculation with exactly `ex` exchanges: a + b, or a − b. */
function draw(ex: number, add: boolean, rng: Rng): { a: number; b: number } {
  for (let i = 0; i < 2000; i++) {
    const b = rng() < 0.5 ? ri(rng, 100, 999) : ri(rng, 1000, 8999);
    const a = ri(rng, 1000, add ? 8999 : 9999);
    const r = add ? a + b : a - b;
    if (r < 1000 || r > 9999) continue;
    if ((add ? carries(a, b) : borrows(a, b)) === ex) return { a, b };
  }
  return add ? { a: 1234 + 100 * ex, b: [321, 289, 898][ex] } : { a: [5678, 5236, 5123][ex], b: [234, 1478, 1895][ex] };
}

function build(ex: number, rng: Rng): Question {
  const add = rng() < 0.5;
  const { a, b } = draw(ex, add, rng);
  const sum = `${f(a)} ${add ? '+' : MINUS} ${f(b)} = ?`;
  return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer.`, answer: f(add ? a + b : a - b), total: 6, hint: 'Slice the digits in order' });
}

/** d3 check card: the answer is the calculation's first number; decoys are the wrong operation and the dropped carry (±100, ±10). */
function check(rng: Rng): Question {
  const add = rng() < 0.5;
  const { a, b } = draw(2, add, rng);
  const c = add ? a + b : a - b;
  const given = `${f(a)} ${add ? '+' : MINUS} ${f(b)} = ${f(c)}`;
  const back = `${f(c)} ${add ? MINUS : '+'} ${f(b)} = ?`;
  const wrongOp = add ? c + b : Math.abs(c - b);
  const pool = [wrongOp, rng() < 0.5 ? a - 100 : a + 100, rng() < 0.5 ? a - 10 : a + 10];
  const wrong = [...new Set(pool.filter(v => v !== a && v >= 0))];
  for (const v of shuffle(rng, [a - 100, a + 100, a - 10, a + 10, a - 1000, a + 1000])) if (wrong.length < 3 && v !== a && v >= 0 && !wrong.includes(v)) wrong.push(v);
  const prompt = `${given}. Check: ${back}`;
  return wordQ(rng, prompt, f(a), wrong.slice(0, 3).map(f), { say: `${q(given).say}. Check: ${q(back).say}` });
}

export const y4Column: Generator = (d: Difficulty, rng): Question => d === 3 && rng() < 0.5 ? check(rng) : build(d === 1 ? 0 : d === 2 ? 1 : 2, rng);
