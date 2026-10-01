// y3-missing (#1086): missing-number problems to 1,000. The gap moves around the equation, and from d3 the
// "=" sometimes comes first (`523 = ? + 178`), so it reads "is the same as". Every number is 1–999, no gap is 0.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, q } from './util';

const MINUS = '−';
type Gap = 'a' | 'b' | 'c'; // the gap is never the result `c`, which stays beside the "="
const digits = (n: number) => String(n);
const hundreds = (n: number) => Math.floor(n / 100);
/** A column needs an exchange: units or tens carry on an addition, or the top digit is smaller on a subtraction. */
const exchanges = (a: number, b: number, add: boolean) =>
  [1, 10].some(p => add ? Math.floor(a / p) % 10 + Math.floor(b / p) % 10 > 9 : Math.floor(a / p) % 10 < Math.floor(b / p) % 10);

/** `a op b = c`, all within 1–999, shaped by the difficulty. */
function triple(d: Difficulty, add: boolean, rng: () => number): { a: number; b: number; c: number } {
  for (;;) {
    const a = ri(rng, 100, 999);
    let b: number;
    if (d === 1) b = rng() < 0.5 ? 10 * ri(rng, 1, 90) : 100 * ri(rng, 1, 8);
    else b = d === 2 ? ri(rng, 10, 99) : ri(rng, 100, 899);
    const c = add ? a + b : a - b;
    if (c < 100 || c > 999 || (d === 3 && !exchanges(a, b, add))) continue;
    return { a, b, c };
  }
}

/** Wrong answers a child makes: the wrong operation, the place-value shift, the number beside "=" copied, a dropped exchange. */
function decoys(x: number, v: Record<Gap, number>, gap: Gap, add: boolean, rng: () => number): number[] {
  const ok = (n: number) => n >= 1 && n <= 999 && n !== x;
  const op = gap === 'a' ? (add ? v.c + v.b : v.c - v.b) : v.a + v.c;
  const exchange = [x + 10, x - 10, x + 100, x - 100].filter(n => ok(n) && n % 10 === x % 10);
  const slip = [x * 10, x / 10].filter(n => Number.isInteger(n) && ok(n));
  const copied = [v.a, v.b, v.c].filter(n => n !== x && ok(n));
  const picked: number[] = [];
  const take = (list: number[]) => { const n = list.find(m => ok(m) && !picked.includes(m)); if (n !== undefined) picked.push(n); };
  take(shuffle(rng, exchange.filter(n => hundreds(n) === hundreds(x)).concat(exchange))); // shares the units, usually the hundreds too
  take([op]); take(shuffle(rng, slip)); take(shuffle(rng, copied));
  take([x + 1, x - 1, x + 2, x - 2].filter(n => hundreds(n) === hundreds(x))); // shares the hundreds
  for (let n = 3; picked.length < 3 && n < 40; n++) take([x + n, x - n]);
  return picked.slice(0, 3);
}

export const y3Missing: Generator = (d, rng): Question => {
  const add = rng() < 0.5;
  const { a, b, c } = triple(d, add, rng);
  const gap: Gap = d === 1 ? 'b' : pick(rng, ['a', 'b', 'c'] as const).valueOf() === 'c' ? 'b' : pick(rng, ['a', 'b'] as const);
  const x = { a, b, c }[gap];
  const sign = add ? '+' : MINUS;
  const shown = (k: Gap) => k === gap ? '?' : digits({ a, b, c }[k]);
  const calc = `${shown('a')} ${sign} ${shown('b')}`;
  const prompt = d === 3 && rng() < 0.5 ? `${shown('c')} = ${calc}` : `${calc} = ${shown('c')}`;
  const options = shuffle(rng, [x, ...decoys(x, { a, b, c }, gap, add, rng)].map(String));
  const card: Question = { ...q(prompt), answer: String(x), options };
  return d === 3 ? { ...card, slow: true } : card;
};
