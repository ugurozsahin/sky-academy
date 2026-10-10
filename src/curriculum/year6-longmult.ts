// y6-longmult (#1254): long multiplication, up to 4 digits × 2 digits (NC 6M5). d1 2-digit × 2-digit and d2 3-digit × 2-digit are
// pick-one; d3 is 4-digit × 2-digit built digit by digit (`buildQ`, five or six slots, the sum stays on the card) and marked `slow`.
// Pick-one decoys are the long-multiplication slips: the missing placeholder zero, one partial product, a dropped carry, a place shift.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';

const MAX = 9999999;
const f = (n: number) => fmt(dec(n, 0));

const lastOf = (v: number) => f(v).slice(-1), leadOf = (v: number) => f(v)[0];
const twins = (ds: number[], answer: number) => ds.some(v => lastOf(v) === lastOf(answer)) && ds.some(v => leadOf(v) === leadOf(answer));

/** Keep the answer from standing out by its units or leading digit: swap a slip (never the first `keep`, the named ones) for a fill (#1058). */
function keepTwins(out: number[], fills: number[], answer: number, keep: number): void {
  for (let i = keep; i < out.length && !twins(out, answer); i++) {
    const swap = fills.find(v => !out.includes(v) && twins(out.map((x, j) => j === i ? v : x), answer));
    if (swap !== undefined) out[i] = swap;
  }
}

/** Decoys for `a × b` (b has non-zero tens and ones digits): the named slips first, then ±10^k fills that keep a last-digit and a leading-digit twin. */
function decoys(a: number, b: number, rng: Rng): number[] {
  const answer = a * b, t = Math.floor(b / 10), u = b % 10, ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX && v !== answer;
  const carry = answer - 10 * (rng() < 0.5 ? 1 : 10);   // a dropped carry shifts the answer by a power of ten
  const named = [a * t + a * u, a * u, carry, answer * 10, answer / 10];   // missing placeholder zero first, then the rest
  const out: number[] = [];
  for (const v of [named[0], ...shuffle(rng, named.slice(1))]) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, 100, 1000, 10000, 1].flatMap(m => [answer + m, answer - m])).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, 1);
  return out;
}

/** A 2-digit multiplier with a non-zero tens and ones digit, so the missing-zero slip differs from the answer. */
const twoDigit = (rng: Rng, lo = 12) => { for (;;) { const b = ri(rng, lo, 99); if (b % 10) return b; } };

function pickOne(a: number, b: number, rng: Rng): Question {
  const sum = `${f(a)} × ${f(b)} = ?`;
  return wordQ(rng, sum, f(a * b), decoys(a, b, rng).map(f), { say: q(sum).say });
}

export const y6LongMult: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return pickOne(ri(rng, 12, 99), twoDigit(rng), rng);
  if (d === 2) return pickOne(ri(rng, 100, 999), twoDigit(rng), rng);
  const a = ri(rng, 1000, 9999), b = twoDigit(rng, 11), sum = `${f(a)} × ${f(b)} = ?`, answer = f(a * b);
  const slots = answer.replace(/\D/g, '').length;   // 5 or 6: 11,000 to 989,901
  return { ...buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer.`, answer, total: Math.min(10, slots + 3), hint: 'Slice the digits in order' }), slow: true };
};
