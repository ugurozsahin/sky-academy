// y5-longmult (#1187): multiply up to 4 digits by 1 or 2 digits (5M14). d1 3-digit × 1-digit (pick-one); d2 4-digit × 1-digit
// or 2-digit × 2-digit (pick-one); d3 half build a 4-digit product of two 2-digit numbers (`_,___`), half pick-one for
// 3- or 4-digit × 2-digit. A built answer never has more than 4 digits: every product of 5 or more digits is a pick-one card
// whose decoys are the long-multiplication slips (the missing zero on the tens row, one partial product, a dropped carry).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ, q } from './util';
import { buildQ } from './build';
import { dec, fmt } from './ks2num';
import { keepTwins } from './year5-column';

const MAX = 999999;
const f = (n: number) => fmt(dec(n, 0));

/** Pick-one decoys for `a × b`: the named slips first, then ±10^k fills that keep a last-digit and a leading-digit twin. */
function decoys(a: number, b: number, rng: Rng): number[] {
  const answer = a * b, ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= MAX && v !== answer;
  const named: number[] = [];
  if (b >= 10) {
    const t = Math.floor(b / 10), u = b % 10;
    named.push(a * t + a * u, a * u, answer * 10, answer / 10);   // missing placeholder zero, one partial product, place shift
  } else named.push(answer - 10 * pick(rng, [1, 10]), answer + a, answer * 10, answer / 10);   // dropped carry, one group too many, shift
  const out: number[] = [];
  for (const v of named) if (out.length < 3 && ok(v) && !out.includes(v)) out.push(v);
  const fills = shuffle(rng, [10, 100, 1000, 10000, 1].flatMap(m => [answer + m, answer - m])).filter(ok);
  for (const v of fills) if (out.length < 3 && !out.includes(v)) out.push(v);
  keepTwins(out, fills, answer, 1);
  return out;
}

function pickOne(a: number, b: number, rng: Rng): Question {
  const sum = `${f(a)} × ${f(b)} = ?`;
  return wordQ(rng, sum, f(a * b), decoys(a, b, rng).map(f), { say: q(sum).say });
}

/** A 2-digit multiplier with a non-zero tens and ones digit, so the missing-zero slip differs from the answer. */
const twoDigit = (rng: Rng) => { for (;;) { const b = ri(rng, 11, 99); if (b % 10) return b; } };

/** d3 (a): 2-digit × 2-digit with a product of 1,000–9,999; the child slices the digits, the comma already printed. */
function build(rng: Rng): Question {
  for (;;) {
    const a = ri(rng, 12, 99), b = twoDigit(rng);
    if (a * b < 1000 || a * b > 9999) continue;
    const sum = `${f(a)} × ${f(b)} = ?`;
    return buildQ(rng, { prompt: sum, say: `${q(sum).say}. Build the answer.`, answer: f(a * b), total: 6, hint: 'Slice the digits in order' });
  }
}

export const y5LongMult: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return pickOne(ri(rng, 100, 999), ri(rng, 2, 9), rng);
  if (d === 2) return rng() < 0.5 ? pickOne(ri(rng, 1000, 9999), ri(rng, 2, 9), rng) : pickOne(ri(rng, 12, 99), twoDigit(rng), rng);
  return rng() < 0.5 ? build(rng) : pickOne(ri(rng, 100, 9999), twoDigit(rng), rng);
};
