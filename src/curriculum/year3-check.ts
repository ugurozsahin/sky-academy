// y3-check (#1085): estimate to the nearest hundred, then check a calculation with its inverse. Estimate operands
// sit within 4 of a hundred so no rounding rule is needed (that is Year 4). Every number is 0–1,000.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, wordQ } from './util';

const MINUS = '−';
const near = (rng: () => number) => 100 * ri(rng, 1, 9) + pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4]);
const hundred = (n: number) => Math.round(n / 100) * 100;
/** Column test: a subtraction needs an exchange, an addition a carry, in the units or tens. */
const columns = (a: number, b: number, add: boolean) =>
  [1, 10].some(p => add ? Math.floor(a / p) % 10 + Math.floor(b / p) % 10 > 9 : Math.floor(a / p) % 10 < Math.floor(b / p) % 10);

function estimate(rng: () => number): Question {
  for (;;) {
    const a = near(rng), b = near(rng), add = rng() < 0.5;
    const ans = hundred(a) + (add ? 1 : -1) * hundred(b);
    if (add ? a + b > 1000 || ans > 900 : a - b < 100) continue; // no 4-digit label (#1047 wants a comma)
    const decoys = [ans - 100, ans + 100, ans / 10, ans - 200, ans + 200].filter(v => v > 0 && v < 1000 && v !== ans);
    const sign = add ? '+' : MINUS;
    return wordQ(rng, `About how much is ${a} ${sign} ${b}?`, String(ans), decoys.map(String),
      { say: `About how much is ${a} ${add ? 'plus' : 'minus'} ${b}?` });
  }
}

function check(d: Difficulty, rng: () => number): Question {
  for (;;) {
    const add = d === 2 ? false : rng() < 0.5;
    const a = ri(rng, 100, 999), b = ri(rng, 100, 899);
    const c = add ? a + b : a - b;
    // a = b, or b = 2a (or a = 2b), would let a decoy `b − a` evaluate to 0 or to a second right answer.
    if (c < 100 || c > 999 || a === b || b === 2 * a || a === 2 * b || (d === 3 && !columns(a, b, add))) continue;
    const sign = add ? '+' : MINUS;
    // `ans` is the calculation that checks it: c − b (or c − a, never both) for an addition, c + b for a subtraction.
    const ans = add ? `${c} ${MINUS} ${rng() < 0.5 ? b : a}` : `${c} + ${b}`;
    const decoys = add
      ? [`${a} + ${c}`, `${Math.max(a, b)} ${MINUS} ${Math.min(a, b)}`, `${c} + ${b}`]
      : [`${a} + ${c}`, `${a} + ${b}`, `${c} ${MINUS} ${b}`];
    const say = (s: string) => s.replace(MINUS, 'minus').replace('+', 'plus');
    return wordQ(rng, `Which checks ${a} ${sign} ${b} = ${c}?`, ans, decoys,
      { say: `Which calculation checks ${say(`${a} ${sign} ${b}`)} equals ${c}?` });
  }
}

export const y3Check: Generator = (d, rng): Question => d === 1 || (d === 3 && rng() < 0.5) ? estimate(rng) : check(d, rng);
