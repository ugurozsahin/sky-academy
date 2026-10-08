// y5-round (#1177): round a number of up to six digits to the nearest 10, 100, 1,000, 10,000 or 100,000. The number is
// on the card and the bubbles carry rounded values. d1 a 4-digit number to 10 or 100; d2 a 5- or 6-digit number to
// 1,000 or 10,000; d3 a 6-digit number to 100,000, or a deciding digit of 5 (a half rounds up), or a carry (99,960 → 100,000).
// Decoys are the slips a child makes: rounded the wrong way (the other neighbouring multiple) and rounded at the wrong place.
import type { Difficulty, Generator, Question } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt } from './ks2num';
import { ks2Say } from './ks2say';

const MAX = 1000000;
const fmtN = (n: number) => fmt(dec(n, 0));
const PLACE_WORD: Record<number, string> = { 10: 'ten', 100: 'hundred', 1000: 'thousand', 10000: 'ten thousand', 100000: 'hundred thousand' };
const roundTo = (n: number, p: number) => Math.round(n / p) * p;

/** The number to round, and the power of ten to round it to, for one difficulty. */
function draw(d: Difficulty, rng: () => number): { n: number; p: number } {
  let n: number, p: number;
  if (d === 1) { p = pick(rng, [10, 100]); n = ri(rng, 1000, 9999); }
  else if (d === 2) { p = pick(rng, [1000, 10000]); n = ri(rng, 10000, 999999); }
  else {
    const kind = pick(rng, ['top', 'half', 'carry'] as const);
    if (kind === 'top') { p = 100000; n = ri(rng, 100000, 999999); }
    else if (kind === 'half') {
      p = pick(rng, [10, 100, 1000, 10000, 100000]);
      const lo = Math.max(1000, p), base = ri(rng, Math.ceil(lo / p), Math.floor(999999 / p) - 1) * p;
      n = base + (p / 10) * 5 + (p > 10 ? ri(rng, 0, p / 10 - 1) : 0);
    } else {
      p = pick(rng, [10, 100, 1000, 10000, 100000]);
      const top = Math.max(4, String(p).length), digits = ri(rng, top, 6);
      n = 10 ** digits - ri(rng, 1, p / 2 - 1 || 1);
    }
  }
  return n % p === 0 ? draw(d, rng) : { n, p };
}

/** Misconception decoys first: rounded the wrong way, then at the wrong place (a place finer or coarser), then a one-step slip so the leading digit does not give the answer away; distinct, in range. */
function decoys(n: number, p: number, answer: number, rng: () => number): number[] {
  const wrongWay = answer > n ? answer - p : answer + p;
  const named = [wrongWay, roundTo(n, p / 10), roundTo(n, p * 10)];
  const ok = (v: number) => v !== answer && v >= 0 && v <= MAX;
  const pool = new Set<number>(named.filter(ok));
  const fill = shuffle(rng, [wrongWay + (wrongWay > answer ? p : -p), answer + 2 * p, answer - 2 * p, roundTo(n, p * 100), answer - 3 * p, answer + 3 * p, answer + p / 10, answer - p / 10]);
  for (const v of fill) if (pool.size < 3 && ok(v)) pool.add(v);
  const out = [...pool].slice(0, 3), lead = String(answer)[0];
  // Rounding up changes the leading digit (367,000 → 400,000), so give the answer a decoy that shares it: one place-step slip.
  if (!out.some(v => String(v)[0] === lead)) {
    const near = shuffle(rng, [answer + p / 10, answer - p / 10, answer + 2 * (p / 10), answer - 2 * (p / 10)]).find(v => ok(v) && !out.includes(v) && String(v)[0] === lead);
    if (near !== undefined) out[out.length - 1] = near;
  }
  return out;
}

export const y5Round: Generator = (d, rng): Question => {
  const { n, p } = draw(d, rng);
  const answer = roundTo(n, p);
  const prompt = `Round ${fmtN(n)} to the nearest ${fmtN(p)}`;
  const say = ks2Say(`Round ${fmtN(n)} to the nearest ${PLACE_WORD[p]}`);
  return wordQ(rng, prompt, fmtN(answer), decoys(n, p, answer, rng).map(fmtN), { say });
};
