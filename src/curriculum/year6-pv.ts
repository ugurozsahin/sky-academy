// y6-pv (#1252): place value to 10,000,000. d1 the value of a digit in a seven-digit number, d2 a number read from words
// into numerals, d3 the greatest or smallest of four close numbers. Decoys are the slips a child makes: the digit one
// place left or right, its face value, a zero added, dropped or put in the wrong place, and numbers that differ in an
// inner place only (so the last digit never gives the answer away).
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt, wordsFor } from './ks2num';

const fmtN = (n: number) => fmt(dec(n, 0));
const dedupe = (answer: number, xs: number[]) => [...new Set(xs)].filter(v => v !== answer);

/** The value of one digit: it is non-zero, appears once and is not the units digit (whose value would be its face value). */
function valueCard(rng: Rng): Question {
  for (;;) {
    const n = ri(rng, 1000000, 9999999), s = String(n);
    const places = [...s].map((c, i) => ({ c, k: 6 - i })).filter(p => p.k > 0 && p.c !== '0' && s.indexOf(p.c) === s.lastIndexOf(p.c));
    if (!places.length) continue;
    const { c, k } = pick(rng, places), digit = Number(c), answer = digit * 10 ** k;
    // One place left, one place right, face value; then two places either side when one of those is a repeat or out of range.
    const decoys = dedupe(answer, [k + 1, k - 1, 0, k + 2, k - 2, k + 3, k - 3].filter(j => j >= 0 && j <= 6).map(j => digit * 10 ** j)).slice(0, 3);
    const prompt = `What is the value of the ${c} in ${fmtN(n)}?`;
    return wordQ(rng, prompt, fmtN(answer), decoys.map(fmtN), { say: prompt });
  }
}

/** A seven-digit number with one to three non-zero digits, read from its words; decoys move, drop or add a zero. */
function wordsCard(rng: Rng): Question {
  for (;;) {
    const nonZero = ri(rng, 1, 3), at = new Set([0, ...shuffle(rng, [1, 2, 3, 4, 5, 6]).slice(0, nonZero - 1)]);
    const digits = Array.from({ length: 7 }, (_, i) => (at.has(i) ? ri(rng, 1, 9) : 0));
    const n = Number(digits.join('')), words = wordsFor(n);
    if (words.length > 56) continue;
    const swaps: number[] = [];
    for (let i = 1; i < 6; i++) {
      if ((digits[i] === 0) === (digits[i + 1] === 0)) continue;
      const sw = digits.slice(); [sw[i], sw[i + 1]] = [sw[i + 1], sw[i]];
      swaps.push(Number(sw.join('')));
    }
    const zeros = digits.map((d, i) => (d === 0 && i > 0 ? i : -1)).filter(i => i > 0);
    const drop = zeros.length ? pick(rng, zeros) : -1;
    const dropped = drop > 0 ? [Number(digits.filter((_, i) => i !== drop).join(''))] : [];
    const added = Number(digits.slice(0, 1).concat(0, digits.slice(1)).join(''));
    const decoys = dedupe(n, [...dropped, added, ...shuffle(rng, swaps), n * 10, n % 10 === 0 ? n / 10 : n + 10 ** ri(rng, 0, 5)]).slice(0, 3);
    if (decoys.length < 3) continue;
    const prompt = `In digits: ${words}`;
    return wordQ(rng, prompt, fmtN(n), decoys.map(fmtN), { say: prompt });
  }
}

/** Four distinct seven-digit numbers sharing their leading and last digits; they differ in one or two inner places. */
function compareCard(rng: Rng): Question {
  for (;;) {
    const base = Array.from({ length: 7 }, (_, i) => (i === 0 ? ri(rng, 1, 9) : ri(rng, 0, 9)));
    const nums = new Set<number>([Number(base.join(''))]);
    for (let tries = 0; nums.size < 4 && tries < 40; tries++) {
      const v = base.slice(), i = ri(rng, 1, 4);
      if (rng() < 0.5) [v[i], v[i + 1]] = [v[i + 1], v[i]];
      else v[i] = ri(rng, 0, 9);
      nums.add(Number(v.join('')));
    }
    if (nums.size < 4) continue;
    const opts = [...nums], greatest = rng() < 0.5, answer = greatest ? Math.max(...opts) : Math.min(...opts);
    const prompt = greatest ? 'Which is the greatest?' : 'Which is the smallest?';
    return wordQ(rng, prompt, fmtN(answer), opts.filter(v => v !== answer).map(fmtN), { say: prompt, optionsAreContent: true });
  }
}

export const y6Pv: Generator = (d: Difficulty, rng): Question => (d === 1 ? valueCard(rng) : d === 2 ? wordsCard(rng) : compareCard(rng));
