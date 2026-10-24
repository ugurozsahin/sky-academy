// y4-round (#1134): round to the nearest 10, 100 or 1,000, and estimate a number on a 0–10,000 line. d1 a number
// from 1,000–1,999 to the nearest 10; d2 1,000–9,999 to the nearest 100 or 1,000; d3 half rounding (with roll-overs
// such as 9,960 → 10,000) and half "Which number is about here?" on an `ends` line. Decoys are the slips a child
// makes: rounded the wrong way, and rounded to the wrong place. A number exactly halfway rounds up.
import type { Difficulty, Generator, Question, Rng } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt, roundTo as roundDec, roundWhy } from './ks2num';

const fmtN = (n: number) => fmt(dec(n, 0));
const PLACE_WORD: Record<number, string> = { 10: 'ten', 100: 'hundred', 1000: 'thousand' };
const MAX = 10000;
type Place = 10 | 100 | 1000;

/** The number to round and the place to round it to; never a number that is already a multiple of the place. */
function draw(d: Difficulty, rng: Rng): { n: number; p: Place } {
  let n: number, p: Place;
  if (d === 1) { p = 10; n = ri(rng, 1000, 1999); }
  else if (d === 2) { p = pick(rng, [100, 1000] as const); n = ri(rng, 1000, 9999); }
  else {
    p = pick(rng, [10, 100, 1000] as const);
    // One draw in three sits just under a multiple of ten thousand, so the answer rolls over a place.
    n = rng() < 0.33 ? MAX - ri(rng, 1, p / 2 - 1 + (p === 10 ? 1 : 0)) : ri(rng, 1000, 9999);
  }
  return n % p === 0 ? draw(d, rng) : { n, p };
}

/** Misconception decoys first: rounded the wrong way, then at the wrong place; the last is swapped for a near multiple
 *  that shares the answer's leading digit when none does, so the first digit alone never gives the answer away. */
function roundDecoys(n: number, p: Place, answer: number, rng: Rng): number[] {
  const ok = (v: number) => v !== answer && v >= 0 && v <= MAX;
  const wrongWay = answer > n ? answer - p : answer + p;
  const finer = p === 10 ? [] : [roundDec(dec(n, 0), (p / 10) as 10 | 100).v];
  const coarser = p === 1000 ? [] : [roundDec(dec(n, 0), (p * 10) as 100 | 1000).v];
  const pool = new Set<number>([wrongWay, ...finer, ...coarser].filter(ok));
  for (const v of shuffle(rng, [answer + 2 * p, answer - 2 * p, answer + p, answer - p, answer + 3 * p, answer - 3 * p])) if (pool.size < 3 && ok(v)) pool.add(v);
  const out = [...pool].slice(0, 3), lead = String(answer)[0];
  if (!out.some(v => String(v)[0] === lead)) {
    const near = shuffle(rng, [answer + p / 10, answer - p / 10, answer + 2 * p / 10, answer - 2 * p / 10, answer + 100, answer - 100, 1000, 100]).find(v => ok(v) && !out.includes(v) && String(v)[0] === lead);
    if (near !== undefined) out[out.length - 1] = near;
  }
  return out;
}

/** The rounding-only generator (exported so the leak test measures it without the line cards). */
export const y4RoundCard = (d: Difficulty, rng: Rng): Question => {
  const { n, p } = draw(d, rng);
  const answer = roundDec(dec(n, 0), p).v;
  const word = PLACE_WORD[p];
  return wordQ(rng, `${fmtN(n)} to the nearest ${p === 10 ? '10' : fmtN(p)}?`, fmtN(answer), roundDecoys(n, p, answer, rng).map(fmtN),
    { say: `Round ${fmtN(n)} to the nearest ${word}.`, hint: 'Slice the rounded number', hintIsData: false, why: roundWhy(n, p) });
};

/** Two multiples of 1,000, each at least 3,000 from the answer and from each other, never 0 or 10,000. */
function lineDecoys(k: number, rng: Rng): number[] {
  const far = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => Math.abs(x - k) >= 3));
  for (const a of far) for (const b of far) if (a !== b && Math.abs(a - b) >= 3) return [a * 1000, b * 1000];
  return [];
}

const LABELS = Array.from({ length: 11 }, (_, i) => fmtN(i * 1000));

function lineCard(rng: Rng): Question {
  const k = ri(rng, 1, 9), mark = k * 1000;
  return wordQ(rng, 'Which number is about here?', fmtN(mark), lineDecoys(k, rng).map(fmtN), {
    visual: { type: 'numberline', from: 0, to: MAX, step: 1000, mark, ends: true, labels: LABELS },
    say: 'The line goes from 0 to 10,000. Which number is at the question mark?',
    hint: 'Slice the number at the ?', hintIsData: false, why: `The ? sits at ${fmtN(mark)}.`,
  });
}

export const y4Round: Generator = (d, rng) => d === 3 && rng() < 0.5 ? lineCard(rng) : y4RoundCard(d, rng);
