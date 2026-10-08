// y5-column (#1182): add and subtract numbers with more than 4 digits (columnar), and round to check (NC 5M7, 5M9).
// d1 a Year 4 recap (4 digits, pick-one); d2 5- and 6-digit sums and differences (pick-one); d3 half build a 4-digit
// answer from two 5-digit numbers (`_,___`), half round both numbers to estimate. A built answer never has more than 4
// digits: every answer of 5 or more digits is a pick-one card whose decoys are the column mistakes.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';

const MINUS = '−';
const MAX = 999999;
const f = (n: number) => fmt(dec(n, 0));
const roundTo = (n: number, p: number) => Math.round(n / p) * p;
const PLACE_WORD: Record<number, string> = { 1000: 'thousand', 10000: 'ten thousand' };
const lastOf = (n: number) => n % 10;
const leadOf = (n: number) => String(n)[0];

/** Columns (10, 100, …) from which a carry (add) or an exchange (subtract) moves to the next column. */
const exchanges = (a: number, b: number, add: boolean) =>
  [10, 100, 1000, 10000, 100000].filter(m => add ? a % m + b % m >= m : a % m < b % m);

/** Subtracting the smaller digit from the larger in every column, whichever number it sits in. */
function smallerFromLarger(a: number, b: number): number {
  const x = String(a), y = String(b).padStart(x.length, '0');
  return Number([...x].map((c, i) => Math.abs(Number(c) - Number(y[i]))).join(''));
}

export const twins = (ds: number[], answer: number) => ds.some(v => lastOf(v) === lastOf(answer)) && ds.some(v => leadOf(v) === leadOf(answer));

/** Keep the answer from standing out by its units or leading digit: swap a slip (never the first `keep`, the named ones) for a fill. */
export function keepTwins(out: number[], fills: number[], answer: number, keep: number): void {
  for (let i = keep; i < out.length && !twins(out, answer); i++) {
    const swap = fills.find(v => !out.includes(v) && twins(out.map((x, j) => j === i ? v : x), answer));
    if (swap !== undefined) out[i] = swap;
  }
}

/** Pick-one decoys for `a ± b`: the column mistakes first, then ±10 fills that keep the answer's last and leading digit twins. */
function decoys(a: number, b: number, add: boolean, rng: Rng): number[] {
  const answer = add ? a + b : a - b, ex = exchanges(a, b, add);
  const ok = (v: number) => v !== answer && v >= 0 && v <= MAX;
  // Always one named slip first: the dropped carry for an addition, smaller-from-larger for a subtraction.
  const sfl = add ? [answer - pick(rng, ex)] : [smallerFromLarger(a, b)];
  const slips = ex.flatMap(m => [answer - m, answer + m]);
  const shift = add ? a + b * 10 : a - b * 10;
  const out: number[] = [];
  for (const v of [...sfl, ...shuffle(rng, [...slips, shift])]) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [answer + 10, answer - 10, answer + 100, answer - 100, answer + 1000, answer - 1000, answer + 1, answer - 1]).filter(v => ok(v));
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, sfl.length);
  return out;
}

/** An exact a ± b with `ex` carries or exchanges (or any number when `ex` is -1), both numbers and the answer in range. */
function draw(d: Difficulty, rng: Rng): { a: number; b: number; add: boolean } {
  for (let i = 0; i < 4000; i++) {
    const add = rng() < 0.5;
    let a: number, b: number;
    if (d === 1) { a = ri(rng, 1000, 8999); b = ri(rng, 1000, 8999); }
    else { a = ri(rng, 10000, 999999); b = pick(rng, [ri(rng, 1000, 9999), ri(rng, 10000, 99999), ri(rng, 100000, 999999)]); }
    const r = add ? a + b : a - b;
    if (r < (d === 1 ? 1000 : 10000) || r > (d === 1 ? 9999 : MAX)) continue;
    if (d === 1 ? exchanges(a, b, add).length < 1 || exchanges(a, b, add).length > 2 : exchanges(a, b, add).length < 2) continue;
    return { a, b, add };
  }
  return { a: 48915, b: 31207, add: true };
}

function pickOne(d: Difficulty, rng: Rng): Question {
  const { a, b, add } = draw(d, rng);
  const sum = `${f(a)} ${add ? '+' : MINUS} ${f(b)} = ?`;
  return wordQ(rng, sum, f(add ? a + b : a - b), decoys(a, b, add, rng).map(f), { say: q(sum).say });
}

/** d3 (a): 5-digit − 5-digit with a difference of 1,000–9,999; the child slices the 4-digit answer, the comma already printed. */
function build(rng: Rng): Question {
  for (;;) {
    const a = ri(rng, 20000, 99999), b = a - ri(rng, 1000, 9999);
    if (b < 10000 || exchanges(a, b, false).length < 1) continue;
    const sum = `${f(a)} ${MINUS} ${f(b)} = ?`;
    return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer.`, answer: f(a - b), total: 6, hint: 'Slice the digits in order' });
  }
}

/** The three wrong estimates: the ×10 slip first, then a number rounded the wrong way, then the wrong place or a step off. */
function estimateDecoys(a: number, b: number, p: number, add: boolean, rng: Rng): number[] {
  const ra = roundTo(a, p), rb = roundTo(b, p), answer = add ? ra + rb : ra - rb;
  const way = (n: number, r: number) => r + (n > r ? p : -p);
  const calc = (x: number, y: number) => add ? x + y : x - y;
  const fill = [calc(way(a, ra), rb), calc(ra, way(b, rb)), calc(roundTo(a, p / 10), roundTo(b, p / 10)), answer + p, answer - p, answer + 2 * p];
  const ds = [answer * 10];
  for (const v of shuffle(rng, fill)) if (ds.length < 3 && v !== answer && v > 0 && v <= MAX && !ds.includes(v)) ds.push(v);
  return ds;
}

/** d3 (b): round both numbers to the nearest 1,000 or 10,000 to estimate the sum or difference. */
function estimate(rng: Rng): Question {
  for (;;) {
    const p = pick(rng, [1000, 10000]), add = rng() < 0.5;
    const a = ri(rng, p === 1000 ? 10000 : 20000, 99999), b = ri(rng, p === 1000 ? 1000 : 10000, 99999);
    const answer = add ? roundTo(a, p) + roundTo(b, p) : roundTo(a, p) - roundTo(b, p);
    if (a % p === 0 || b % p === 0 || answer < 2 * p || answer > 90000 || (!add && a <= b)) continue;
    const ds = estimateDecoys(a, b, p, add, rng), sum = `${f(a)} ${add ? '+' : MINUS} ${f(b)}`;
    if (ds.length < 3) continue;
    const say = `Round both numbers to the nearest ${PLACE_WORD[p]} to estimate. ${q(`${sum} = ?`).say}`;
    return wordQ(rng, `Round both numbers to the nearest ${f(p)} to estimate ${sum}`, f(answer), ds.map(f), { say });
  }
}

export const y5Column: Generator = (d, rng): Question => d === 3 ? (rng() < 0.5 ? build(rng) : estimate(rng)) : pickOne(d, rng);
