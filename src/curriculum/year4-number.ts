// Year 4 number strand (#1069). One topic today (`y4-count`); every other row is a future PR's own slot —
// see the `// slot:`/`// import:` comments. Keep this file ≤300 lines: a generator that would push it past that
// moves to its own `year4-<slug>.ts` and this file keeps only its row/import.
// import: y4-pv
// import: y4-round
// import: y4-roman
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle } from './util';
import { dec, fmt } from './ks2num';
import { y4Negative } from './year4-negative';

// Hand-built `Question`s: options must be comma-formatted via `fmt()` ("4,456"), never `numQ`'s bare String().
const fmtN = (n: number) => fmt(dec(n, 0));

const STEPS = [6, 7, 9, 25, 1000] as const;
const MAX = 10999;
const inRange = (v: number) => v >= 0 && v <= MAX;

/** Four terms of a run, and the index of the "?". d1: 25s/1,000s from 0, next term; d2: 6/7/9 from 0, 25s from
 *  any multiple up to 1,000, next term; d3: any step, may count back (never below 0), gap anywhere after the first. */
function runTerms(d: Difficulty, step: number, rng: () => number): { terms: number[]; gapIndex: number; local: number } {
  const back = d === 3 && rng() < 0.4;
  const local = back ? -step : step;
  let start: number;
  if (back) start = step * ri(rng, 3, Math.floor((step === 1000 ? 9000 : 12 * step) / step));
  else if (d === 2 && step === 25) start = 25 * ri(rng, 0, 40);
  else if (d === 3 && (step === 25 || step === 1000)) start = step * ri(rng, 0, step === 1000 ? 6 : 40);
  else start = 0;
  const terms = [0, 1, 2, 3].map(i => start + i * local);
  return { terms, gapIndex: d === 3 ? pick(rng, [1, 2, 3] as const) : 3, local };
}

/** Misconception decoys first: the skipped term, and a column slip keeping the units digit (±10; ±100 for 25s and 1,000s). */
function runDecoys(answer: number, step: number, local: number, rng: () => number): number[] {
  const slip = step === 25 || step === 1000 ? 100 : 10;
  const pool = new Set<number>([answer + local, rng() < 0.5 ? answer + slip : answer - slip, answer - slip, answer + slip].filter(v => v !== answer && inRange(v)));
  while (pool.size < 3) {
    const v = answer + ri(rng, -Math.max(step, 10), Math.max(step, 10));
    if (v !== answer && inRange(v)) pool.add(v);
  }
  return [...pool].slice(0, 3);
}

function countRun(d: Difficulty, rng: () => number): Question {
  const step = d === 1 ? pick(rng, [25, 1000] as const) : pick(rng, STEPS);
  const { terms, gapIndex, local } = runTerms(d, step, rng);
  const answer = terms[gapIndex];
  const shown = terms.map((t, i) => i === gapIndex ? '?' : fmtN(t)).join(', ');
  const options = shuffle(rng, [answer, ...runDecoys(answer, step, local, rng)]).map(fmtN);
  return { prompt: `${shown} = ?`, say: `Count in ${step === 1000 ? '1,000' : step}s. ${shown.replace(/,(?=[^,]*$)/, ' then')} = what?`, answer: fmtN(answer), options };
}

/** "1,000 more/less than n": d1 stays within 1,000–9,999, d2 any 4-digit number, d3 crosses ten thousand (9,450 → 10,450). */
function moreOrLess(d: Difficulty, rng: () => number): Question {
  const more = rng() < 0.5;
  const sign = more ? 1 : -1;
  let base: number;
  if (d === 3 && more) base = ri(rng, 9000, 9999);
  else if (more) base = ri(rng, 1000, d === 1 ? 8999 : 9999);
  else base = ri(rng, d === 1 ? 2000 : 1000, 9999);
  const answer = base + 1000 * sign;
  const named = [base + 100 * sign, base - 1000 * sign, answer + 100, answer - 100];
  const pool = new Set<number>(named.filter(v => v !== answer && inRange(v)));
  while (pool.size < 3) {
    const v = answer + 100 * ri(rng, -9, 9);
    if (v !== answer && inRange(v)) pool.add(v);
  }
  const prompt = `1,000 ${more ? 'more' : 'less'} than ${fmtN(base)} = ?`;
  return { prompt, say: prompt.replace(' = ?', '. What is it?'), answer: fmtN(answer), options: shuffle(rng, [answer, ...[...pool].slice(0, 3)]).map(fmtN) };
}

export const y4Count: Generator = (d, rng) => rng() < 0.5 ? countRun(d, rng) : moreOrLess(d, rng);

export const Y4_NUMBER: Topic[] = [
  { id: 'y4-count', title: 'Count in 6s, 7s, 9s, 25s and 1,000s', icon: '🔢', subject: 'maths', year: 'year4', nc: 'Y4 NPV: count in 6s, 7s, 9s, 25s, 1,000s; 1,000 more or less', gen: y4Count },
  { id: 'y4-negative', title: 'Negative Numbers', icon: '❄️', subject: 'maths', year: 'year4', nc: 'Y4 NPV: count backwards through 0 to negative numbers', gen: y4Negative },
  // slot: y4-pv
  // slot: y4-round
  // slot: y4-roman
];
