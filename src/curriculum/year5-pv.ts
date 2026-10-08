// y5-pv (#1179): place value to 1,000,000. The big number is on the card and the bubbles carry short answers.
// d1 five-digit numbers: the value of a digit, or 1 / 10 / 100 / 1,000 more or less. d2 six-digit numbers: digit value,
// 10,000 or 100,000 more or less (across a boundary too), or a number written in words. d3 order and compare:
// "second largest" of four numbers that share their first two digits, or "greater than 999,990" with 1,000,000 possible.
// Decoys are the slips a child makes: the same digit at another place, a step at the wrong place or in the wrong direction,
// a zero put in the wrong place when reading words.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt, wordsFor } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 1000000;
const fmtN = (n: number) => fmt(dec(n, 0));
const inRange = (v: number) => v >= 0 && v <= MAX;
/** Up to three distinct in-range decoys: the `first` slips always, then `pool` in random order, then `fill`. */
const three = (rng: Rng, answer: number, first: number[], pool: number[], fill: number[]): string[] => {
  const out = new Set<number>();
  for (const v of [...first, ...shuffle(rng, pool), ...fill]) if (out.size < 3 && v !== answer && inRange(v)) out.add(v);
  return [...out].map(fmtN);
};

/** The value of one digit: a digit that is non-zero and appears once, so "the 7 in 47,215" has one reading. */
function valueCard(rng: Rng, digits: number): Question {
  for (;;) {
    const n = ri(rng, 10 ** (digits - 1), 10 ** digits - 1), s = String(n);
    const places = [...s].map((c, i) => ({ c, k: digits - 1 - i })).filter(p => p.c !== '0' && s.indexOf(p.c) === s.lastIndexOf(p.c));
    if (!places.length) continue;
    const { c, k } = pick(rng, places), d = Number(c);
    const others = Array.from({ length: digits }, (_, j) => j).filter(j => j !== k).map(j => d * 10 ** j);
    const prompt = `What is the value of the ${c} in ${fmtN(n)}?`;
    return wordQ(rng, prompt, fmtN(d * 10 ** k), shuffle(rng, others).slice(0, 3).map(fmtN), { say: ks2Say(prompt) });
  }
}

/** n more or less than a number: decoys are the step at the wrong place and in the wrong direction. */
function countCard(rng: Rng, steps: number[], lo: number, hi: number): Question {
  for (;;) {
    const step = pick(rng, steps), up = rng() < 0.5, n = ri(rng, lo, hi), sign = up ? 1 : -1, answer = n + sign * step;
    if (!inRange(answer)) continue;
    const decoys = three(rng, answer, [n - sign * step], [n + sign * step * 10, n + sign * (step / 10), n - sign * (step / 10)], [n + sign * step * 100, n + sign * 2 * step, n - sign * 2 * step, n + sign * 3 * step, n - sign * 3 * step]);
    if (decoys.length < 3) continue;
    const prompt = `What is ${fmtN(step)} ${up ? 'more' : 'less'} than ${fmtN(n)}?`;
    return wordQ(rng, prompt, fmtN(answer), decoys, { say: ks2Say(prompt) });
  }
}

/** A number written in words, with at most three non-zero digits so the card stays short; decoys misplace a zero. */
function wordsCard(rng: Rng): Question {
  for (;;) {
    const len = ri(rng, 5, 6), nonZero = ri(rng, 2, 3), at = shuffle(rng, Array.from({ length: len }, (_, i) => i)).slice(0, nonZero);
    const digits = Array.from({ length: len }, (_, i) => (at.includes(i) ? ri(rng, 1, 9) : 0));
    if (digits[0] === 0) continue;
    const n = Number(digits.join('')), words = wordsFor(n);
    if (words.length > 48) continue;
    const slips: number[] = [];
    for (let i = 0; i < len - 1; i++) {
      if ((digits[i] === 0) === (digits[i + 1] === 0)) continue;
      const sw = digits.slice(); [sw[i], sw[i + 1]] = [sw[i + 1], sw[i]];
      if (sw[0] !== 0) slips.push(Number(sw.join('')));
    }
    const answer = n, fill = [n * 10, n % 10 === 0 ? n / 10 : 0, n + 10 ** (len - 1)];
    const decoys = three(rng, answer, [], slips, fill);
    if (decoys.length < 3) continue;
    const prompt = `In digits: ${words}`;
    return wordQ(rng, prompt, fmtN(answer), decoys, { say: prompt });
  }
}

/** Four distinct six-digit numbers sharing their first two digits; the answer is the second largest. */
function rankCard(rng: Rng): Question {
  for (;;) {
    const head = ri(rng, 10, 99) * 10000, nums = new Set<number>();
    while (nums.size < 4) nums.add(head + ri(rng, 0, 9999));
    const opts = [...nums], second = [...opts].sort((a, b) => b - a)[1], last = second % 10;
    if (!opts.some(v => v !== second && v % 10 === last)) continue;
    return wordQ(rng, 'Which number is the second largest?', fmtN(second), opts.filter(v => v !== second).map(fmtN), { say: 'Which number is the second largest?' });
  }
}

/** Greater than 999,990: the answer is 999,991 to 999,999 or 1,000,000; the decoys are all below it. */
function greaterCard(rng: Rng): Question {
  const answer = ri(rng, 999991, MAX), x = answer % 10;
  const decoys = [999980 + x, ...shuffle(rng, [999909, 999099, 990999, 909999, 999900, 999000]).slice(0, 2)];
  const prompt = 'Which number is greater than 999,990?';
  return wordQ(rng, prompt, fmtN(answer), decoys.map(fmtN), { say: prompt });
}

export const y5Pv: Generator = (d: Difficulty, rng): Question => {
  if (d === 1) return rng() < 0.5 ? valueCard(rng, 5) : countCard(rng, [10, 100, 1000], 10000, 99999);
  if (d === 2) {
    const kind = pick(rng, ['value', 'count', 'words'] as const);
    return kind === 'value' ? valueCard(rng, 6) : kind === 'count' ? countCard(rng, [10000, 100000], 100000, 999999) : wordsCard(rng);
  }
  return rng() < 0.65 ? rankCard(rng) : greaterCard(rng);
};
