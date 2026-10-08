// y6-round (#1212): round a number of up to seven digits to a required accuracy. The number is on the card and the
// bubbles carry rounded values. d1 a 6-digit number to the nearest 1,000 or 10,000; d2 a 7-digit number to 10,000,
// 100,000 or 1,000,000; d3 a short line with a quantity to round to a stated accuracy (6M23), including half-way
// cases (a half rounds up) and carries (9,960,000 → 10,000,000). Decoys are the slips a child makes: rounded the
// wrong way and rounded at the wrong place.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 10000000;
const fmtN = (n: number) => fmt(dec(n, 0));
const PLACE_WORD: Record<number, string> = { 1000: 'thousand', 10000: 'ten thousand', 100000: 'hundred thousand', 1000000: 'million' };
const roundTo = (n: number, p: number) => Math.round(n / p) * p;
/** Each line is at most 60 characters with the widest n and p (checked by the topic test). */
export const CONTEXTS = [
  (n: string, p: string) => `${n} people live in a city. Nearest ${p}?`,
  (n: string, p: string) => `A stadium sold ${n} tickets. Nearest ${p}?`,
  (n: string, p: string) => `${n} fans watched a match. Nearest ${p}?`,
  (n: string, p: string) => `A town has ${n} trees. Nearest ${p}?`,
];

/** The number to round, and the power of ten to round it to, for one difficulty. */
function draw(d: Difficulty, rng: () => number): { n: number; p: number } {
  let n: number, p: number;
  if (d === 1) { p = pick(rng, [1000, 10000]); n = ri(rng, 100000, 999999); }
  else if (d === 2) { p = pick(rng, [10000, 100000, 1000000]); n = ri(rng, 1000000, 9999999); }
  else {
    p = pick(rng, [1000, 10000, 100000, 1000000]);
    const kind = pick(rng, ['plain', 'half', 'carry'] as const);
    if (kind === 'plain') n = ri(rng, 100000, 9999999);
    else if (kind === 'half') n = ri(rng, 1, Math.floor(9999999 / p) - 1) * p + (p / 10) * 5 + ri(rng, 0, p / 10 - 1);
    else n = 10 ** ri(rng, Math.max(6, String(p).length), 7) - ri(rng, 1, p / 2 - 1);
  }
  return n % p === 0 ? draw(d, rng) : { n, p };
}

/** Misconception decoys first: rounded the wrong way, then at the wrong place, then a one-step slip that shares the answer's leading digit; distinct, in range. */
function decoys(n: number, p: number, answer: number, rng: () => number): number[] {
  const wrongWay = answer > n ? answer - p : answer + p;
  const ok = (v: number) => v !== answer && v >= 0 && v <= MAX;
  const pool = new Set<number>([wrongWay, roundTo(n, p / 10), roundTo(n, p * 10)].filter(ok));
  const fill = shuffle(rng, [wrongWay + (wrongWay > answer ? p : -p), answer + 2 * p, answer - 2 * p, answer - 3 * p, answer + 3 * p, answer + p / 10, answer - p / 10]);
  for (const v of fill) if (pool.size < 3 && ok(v)) pool.add(v);
  const out = [...pool].slice(0, 3), lead = String(answer)[0];
  if (!out.some(v => String(v)[0] === lead)) {
    const near = shuffle(rng, [answer + p / 10, answer - p / 10, answer + 2 * (p / 10), answer - 2 * (p / 10)]).find(v => ok(v) && !out.includes(v) && String(v)[0] === lead);
    if (near !== undefined) out[out.length - 1] = near;
  }
  return out;
}

export const y6Round: Generator = (d, rng): Question => {
  const { n, p } = draw(d, rng);
  const answer = roundTo(n, p);
  const prompt = d === 3 ? pick(rng, CONTEXTS)(fmtN(n), fmtN(p)) : `Round ${fmtN(n)} to the nearest ${fmtN(p)}`;
  const say = ks2Say(d === 3 ? prompt.replace(/Nearest [\d,]+\?$/, `Round to the nearest ${PLACE_WORD[p]}`) : `Round ${fmtN(n)} to the nearest ${PLACE_WORD[p]}`);
  return wordQ(rng, prompt, fmtN(answer), decoys(n, p, answer, rng).map(fmtN), { say });
};
