// Year 4 number strand (#1069). One topic today (`y4-count`); every other row is a future PR's own slot —
// see the `// slot:`/`// import:` comments. Keep this file ≤300 lines: a generator that would push it past that
// moves to its own `year4-<slug>.ts` and this file keeps only its row/import.
// import: y4-negative
// import: y4-round
// import: y4-roman
import type { Difficulty, Generator, Question, Topic } from './types';
import { ri, pick, shuffle, wordQ } from './util';
import { dec, fmt, digitAt } from './ks2num';

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

const POW = [1, 10, 100, 1000] as const;
const digits4 = (n: number) => POW.map(p => digitAt(n, p));

/** "In 1,482, what is the 4 worth?": the asked digit is non-zero and appears once, so one value is right (#666).
 *  Decoys are the same digit in the other three columns: the place-value shift and the bare digit (#1058). */
function digitValueQ(d: Difficulty, rng: () => number): Question {
  let n: number, ds: number[], places: number[];
  do {
    n = ri(rng, 1000, d === 1 ? 1999 : 9999);
    ds = digits4(n);
    places = [0, 1, 2, 3].filter(i => ds[i] !== 0 && ds.filter(x => x === ds[i]).length === 1);
  } while (places.length === 0);
  const place = pick(rng, places);
  const dg = ds[place];
  const answer = dg * POW[place];
  const options = shuffle(rng, POW.map(p => dg * p)).map(fmtN);
  return { prompt: `In ${fmtN(n)}, what is the ${dg} worth?`, say: `In ${fmtN(n)}, what is the ${dg} worth?`, answer: fmtN(answer), options };
}

/** d2 pair: same thousands digit, one or two other columns differ; one card in five is equal. */
function compareQ(rng: () => number): Question {
  const a = ri(rng, 1000, 9999);
  let b = a;
  if (rng() >= 0.2) {
    for (const i of shuffle(rng, [0, 1, 2]).slice(0, ri(rng, 1, 2))) {
      const old = digitAt(a, POW[i]);
      b += (pick(rng, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== old)) - old) * POW[i];
    }
  }
  const ans = a < b ? '<' : a > b ? '>' : '=';
  const say = `${fmtN(a)} compared with ${fmtN(b)}. Less than, greater than, or equal?`;
  return wordQ(rng, `${fmtN(a)} ? ${fmtN(b)}`, ans, ['<', '>', '='], { say, hint: 'Slice the correct sign', hintIsData: false });
}

/** d3: four numbers sharing a thousands digit, sliced smallest first. `answer` is a space join: "4,305" has a comma. */
function orderPvQ(rng: () => number): Question {
  const th = ri(rng, 1, 9) * 1000;
  const set = new Set<number>();
  while (set.size < 4) set.add(th + ri(rng, 0, 999));
  const sorted = [...set].sort((x, y) => x - y).map(fmtN);
  const shown = shuffle(rng, sorted);
  return { prompt: 'Smallest to biggest!', say: `Slice the numbers from smallest to biggest: ${shown.join(', ')}`, answer: sorted.join(' '), sequence: sorted, options: shown, visual: { type: 'word', text: shown.join('  ') }, hint: 'Slice the smallest number first', hintIsData: false };
}

export const y4PlaceValue: Generator = (d, rng) => d === 3 ? orderPvQ(rng) : d === 2 && rng() < 0.5 ? compareQ(rng) : digitValueQ(d, rng);

export const Y4_NUMBER: Topic[] = [
  { id: 'y4-count', title: 'Count in 6s, 7s, 9s, 25s and 1,000s', icon: '🔢', subject: 'maths', year: 'year4', nc: 'Y4 NPV: count in 6s, 7s, 9s, 25s, 1,000s; 1,000 more or less', gen: y4Count },
  // slot: y4-negative
  { id: 'y4-pv', title: 'Place Value, Compare & Order', icon: '🔢', subject: 'maths', year: 'year4', nc: 'Y4 NPV: place value of 4-digit numbers; compare and order beyond 1,000', sequenceFrom: 3, gen: y4PlaceValue },
  // slot: y4-round
  // slot: y4-roman
];
